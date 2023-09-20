import { mkdir, cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import * as cheerio from 'cheerio';
import express from 'express';
import Parser from 'rss-parser';
import { parseString, Builder } from 'xml2js';

import { getUrl, writeFile, renameFields, filterObj, orderObj } from '../utils/index.js';
import { takeAll } from '../utils/async.js';
import { withTmpDir } from '../utils/tests.js';
import { DOWNLOAD_DIR_NAME, MIRRORED_DIR } from '../const.js';
import { createHash } from 'node:crypto';

import { print } from '../dev.js';
import { _testUpdateWriterIntegration } from '../writer.js';

const RSS_PATH = 'rss.xml';
const DEFAULT_LOCAL_ORIGIN = 'http://localhost:8080';
const rssLocation = (name) => join(DOWNLOAD_DIR_NAME, name);

export async function downloadToBuffer (url) {
  const stream = getUrl(url);
  const parts = await takeAll(stream);
  return Buffer.concat(parts);
}

export async function download (url) {
  const buff = await downloadToBuffer(url);
  return buff.toString();
}

export async function writeFromUrl (fileName, url) {
  const str = await download(url);
  await writeFile(fileName, str);
  return str;
}

export async function downloadRss (name, testUrls) {
  const url = testUrls[name];
  const dir = rssLocation(name);
  await mkdir(dir, { recursive: true });
  const str = await writeFromUrl(join(dir, 'feed.rss'), url);
  return str;
}

async function _downloadAllTestUrls (testUrls) {
  for (const name of Object.keys(testUrls)) {
    console.log(`downloading [${name}]`);
    await downloadRss(name, testUrls);
  }
}

export async function serveDirectory (path) {
  const app = express();
  app.use(express.static(path));
  const server = await new Promise(resolve => {
    const out = app.listen(() => {
      resolve(out);
    }
    );
  });
  console.log(`Running on port ${server?.address().port}`);
  return server;
}

export async function serveRss (name) {
  const dir = rssLocation(name);
  return serveDirectory(dir);
}

const urlFromAddress = ({ address, family, port }) => {
  return `http://${family.endsWith('6') ? `[${address}]` : address}:${port}`;
};

const getFeedUrl = (addrObj) => `${urlFromAddress(addrObj)}/feed.rss`;

export async function withRssServer (name, func) {
  const server = await serveRss(name);

  const feedUrl = getFeedUrl(server.address());

  const close = () => new Promise(resolve => server.close(resolve));

  try {
    await func(feedUrl);
    await close();
  } catch (e) {
    await close();
    throw e;
  }
}

export const jsonFromXml = (xml) => new Promise((resolve, reject) => parseString(xml, (err, result) => err ? reject(err) : resolve(result)));

export const xmlFromJson = (json, opts = {}) => (new Builder({ renderOpts: { pretty: false }, ...opts })).buildObject(json);

const itemToRssStyleJson = (item) => {
  item = renameFields(item, [['content', 'description']]);
  item = filterObj(['isoDate', 'contentSnippet'], item);
  item = orderObj(['title', 'link', 'description', 'pubDate', 'guid'], item);
  if (item?.enclosure) {
    const { length, type, url } = item.enclosure;
    item.enclosure = {
      $: {
        url, type, length
      }
    };
  }
  return item;
};

const toRssStyleJson = (obj) => {
  let tmp = { ...obj };
  if (tmp?.items?.length) {
    tmp.items = tmp.items.map((item) => itemToRssStyleJson(item));
  }
  tmp = renameFields(tmp, [['items', 'item']]);
  return {
    rss: {
      $: {
        version: '2.0'
      },
      channel: orderObj(['title', 'link', 'description', 'language', 'channel'], tmp)
    }
  };
};

export async function mutateRss (rssXmlStr, func) {
  const parsed = await (new Parser()).parseString(rssXmlStr);
  const mutated = await func(parsed);
  const rssStyleJson = toRssStyleJson(mutated);
  return xmlFromJson(rssStyleJson);
}

export async function saveUrlAsHash (url, { pathPrefix = './', origin = DEFAULT_LOCAL_ORIGIN } = {}) {
  console.log(`Downloading URL: ${url}`);
  const parts = url.split('.');
  // TODO this was required for imgs to render
  // There should be a more resiliant way to do this
  const extension = parts[parts.length - 1];

  const buffer = await downloadToBuffer(url);
  const d = createHash('sha256').update(buffer).digest();
  const hash = d.toString('base64') + (extension ? '.' + extension : '');
  console.log(`Saving URL [${url}] as [${hash}]`);

  const relPath = join('files', hash);
  const fullPath = join(pathPrefix, relPath);
  await writeFile(fullPath, buffer, { createDir: true });
  const newUrl = new URL(origin);
  newUrl.pathname = relPath;
  return newUrl.href;
}

export async function rewriteImage (item, options) {
  const c = cheerio.load(item.content, null, false);

  const imgElement = c('img');
  if (imgElement.length === 0) {
    return item;
  }

  const ogUrl = imgElement.attr('src');
  const newUrl = await saveUrlAsHash(ogUrl, { ...options });
  imgElement.attr('src', newUrl);

  item.content = c.html();

  return item;
}

export async function rewriteEnclosure (item, options) {
  if (!item.enclosure) {
    return item;
  }

  const newUrl = await saveUrlAsHash(item.enclosure.url, { ...options });
  item.enclosure.url = newUrl;

  return item;
}

export async function rewriteFeedItemAndSaveToDisk (item, options) {
  item = await rewriteImage(item, options);
  item = await rewriteEnclosure(item, options);
  return item;
}

export async function saveRssToDiskFromUrl (url, { pathPrefix = './', maxItems = Number.MAX_VALUE } = {}) {
  const str = await download(url);
  const newXml = await mutateRss(str, async (feed) => {
    const items = [];
    let count = 0;
    for (const item of feed.items) {
      if (count >= maxItems) {
        print(`Reached max items [${count}]`);
        break;
      }
      print(item);
      items.push(await rewriteFeedItemAndSaveToDisk(item, { pathPrefix }));
      count += 1;
    }
    feed.items = items;
    return filterObj(['link'], feed);
  });
  console.log('writing new xml');
  print(newXml);
  await writeFile(join(pathPrefix, RSS_PATH), newXml, { createDir: true });
  print('xml file written');
}

async function replaceInFile (path, before, after, { encoding = 'utf8' } = {}) {
  const beforeContent = await readFile(path, { encoding });
  const regex = new RegExp(before, 'g');
  const afterContent = beforeContent.replace(regex, after);
  await writeFile(path, afterContent, encoding);
}

// TODO sholud this close the server when func is done?
export async function withTmpRssFeed (name, func) {
  // find the rss directory
  const mirrorDir = join(MIRRORED_DIR, name);
  // create tmp dir
  await withTmpDir(async (tmpDir) => {
    // copy dir to tmp dir
    await cp(mirrorDir, tmpDir, { recursive: true });
    // run webserver from tmp dir
    const server = await serveDirectory(tmpDir);
    // get webserver current port
    const urlStr = urlFromAddress(server.address());

    const url = new URL(urlStr);
    url.hostname = '0.0.0.0';
    url.pathname = RSS_PATH;

    const rssXmlPath = join(tmpDir, RSS_PATH);
    const beforeOrigin = DEFAULT_LOCAL_ORIGIN;

    // search and replace localhost:8080 with localhost:NEW_PORT
    replaceInFile(rssXmlPath, beforeOrigin, url.origin);

    print('HREF', url.href);
    // call the func
    await func(url.href);

    // close the server
    await (new Promise(resolve => server.close(resolve)));
  });
}
