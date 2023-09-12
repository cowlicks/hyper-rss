import { mkdir } from 'node:fs/promises';
import path, { join } from 'node:path';

import * as cheerio from 'cheerio';
import express from 'express';
import Parser from 'rss-parser';
import { parseString, Builder } from 'xml2js';

import { getUrl, writeFile, renameFields, filterObj, orderObj } from '../utils/index.js';
import { takeAll } from '../utils/async.js';
import { DOWNLOAD_DIR_NAME, TEST_URLS } from '../const.js';
import { createHash } from 'node:crypto';

import { print } from '../dev.js';

const rssLocation = (name) => join(DOWNLOAD_DIR_NAME, name);

export async function downloadToBuffer (url) {
  const parts = await takeAll(getUrl(url));
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

export async function serveRss (name) {
  const app = express();
  const dir = rssLocation(name);
  app.use(express.static(dir));
  const server = await new Promise(resolve => {
    const out = app.listen(() => {
      resolve(out);
    }
    );
  });
  console.log(`Running on port ${server?.address().port}`);
  return server;
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

const toRssStyleJson = (obj) => {
  let tmp = { ...obj };
  tmp.items = tmp.items
    .map(item => renameFields(item, [['content', 'description']]))
    .map(item => filterObj(['isoDate', 'contentSnippet'], item))
    .map(item => orderObj(['title', 'link', 'description', 'pubDate', 'guid'], item));
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

export async function saveUrlAsHash (url, { pathPrefix = './', extension = '' } = {}) {
  const buffer = await downloadToBuffer(url);
  const d = createHash('sha256').update(buffer).digest();
  const hash = d.toString('base64') + '.' + extension;

  const relPath = join('files', hash);
  const fullPath = join(pathPrefix, relPath);
  await writeFile(fullPath, buffer, { createDir: true });
  return relPath;
}

export async function rewriteFeedItemAndSaveToDisk (item, options) {
  const c = cheerio.load(item.content, null, false);
  const ogUrl = c('img').attr('src');
  const parts = ogUrl.split('.');
  const extension = parts[parts.length - 1];
  const newUrl = await saveUrlAsHash(ogUrl, { ...options, extension });

  c('img').attr('src', newUrl);
  item.content = c.html();

  return item;
}

export async function saveRssToDiskFromUrl (url, { pathPrefix = './' } = {}) {
  const str = await download(url);
  const newXml = await mutateRss(str, async (feed) => {
    const items = [];
    for (const item of feed.items) {
      items.push(await rewriteFeedItemAndSaveToDisk(item, { pathPrefix }));
    }
    feed.items = items;
    return filterObj(['link'], feed);
  });
  writeFile(join(pathPrefix, 'rss.xml'), newXml, { createDir: true });
}

(async () => {
  await saveRssToDiskFromUrl(TEST_URLS.xkcd, { pathPrefix: '/home/blake/tmp/xkcd' });
})();
