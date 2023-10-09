import { mkdir, cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import express from 'express';
import Parser from 'rss-parser';
import { parseString, Builder } from 'xml2js';

import { writeFile, renameFields, filterObj, orderObj, downloadToBuffer } from '../utils/index.js';
import { withTmpDir } from '../utils/tests.js';
import { DOWNLOAD_DIR, MIRRORED_DIR, TEST_URLS } from '../const.js';

import { print } from '../dev.js';
import { downloadAndCreateFilename, itemEnclosureHandler, itemImgHandler } from '../items.js';

const RSS_PATH = 'rss.xml';
const DEFAULT_LOCAL_ORIGIN = 'http://localhost:8080';
const DEFAULT_FILE_DIRECTORY = 'files';
const DEFAULT_PATH_PREFIX = './';

const rssLocation = (name) => join(DOWNLOAD_DIR, name);

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
    },
    );
  });
  console.log(`Running on port ${server?.address().port}`);
  return server;
}

export async function serveRss (name) {
  const dir = rssLocation(name);
  return serveDirectory(dir);
}

export const urlFromAddress = ({ address = 'localhost', family = 'ipv4', port }) => {
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
        url, type, length,
      },
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
        version: '2.0',
      },
      channel: orderObj(['title', 'link', 'description', 'language', 'channel'], tmp),
    },
  };
};

export async function mutateRss (rssXmlStr, func) {
  const parsed = await (new Parser()).parseString(rssXmlStr);
  const mutated = await func(parsed);
  const rssStyleJson = toRssStyleJson(mutated);
  return xmlFromJson(rssStyleJson);
}

function createLocalFilePathAndLocalUrl (url, fileName, {
  fileDirectory = DEFAULT_FILE_DIRECTORY,
  pathPrefix = DEFAULT_PATH_PREFIX,
  origin = DEFAULT_LOCAL_ORIGIN,
}) {
  const relativePath = join(fileDirectory, fileName);
  const filePath = join(pathPrefix, relativePath);

  const newUrl = new URL(origin);
  newUrl.pathname = relativePath;

  return { localUrl: newUrl.href, filePath };
}

export async function downloadUrlAndCreateLocalUrl (url, { ...options } = {}) {
  console.log(`Downloading URL: ${url}`);
  const { buffer, fileName } = await downloadAndCreateFilename(url);

  const { localUrl, filePath } = createLocalFilePathAndLocalUrl(url, fileName, { ...options });

  console.log(`Saving URL [${url}] to [${filePath}]`);
  await writeFile(filePath, buffer, { createDir: true });

  return localUrl;
}

// Find an img tag in the RSS items' content tag and save it to a local file,
// rewrite item's url to point to the new file
export async function rewriteImage (item, options) {
  const out = itemImgHandler(item, (url) => downloadUrlAndCreateLocalUrl(url, { ...options }));
  return out;
}

// Save the data from a RSS enclosure tag to a local file and rewrite the URL
// in the feed to point to the local file
export async function rewriteEnclosure (item, options) {
  const out = await itemEnclosureHandler(item, (url) => downloadUrlAndCreateLocalUrl(url, { ...options }));
  return out;
}

export async function rewriteFeedItemAndSaveToDisk (item, options) {
  item = await rewriteImage(item, options);
  item = await rewriteEnclosure(item, options);
  return item;
}

// test this to verify enclosure changes
export async function saveRssToDiskFromUrl (url, { pathPrefix = MIRRORED_DIR, maxItems = Number.MAX_VALUE } = {}) {
  const str = await download(url);
  const newXml = await mutateRss(str, async (feed) => {
    const items = [];
    let count = 0;
    for (const item of feed.items) {
      if (count >= maxItems) {
        print(`Reached max items [${count}]`);
        break;
      }
      items.push(await rewriteFeedItemAndSaveToDisk(item, { pathPrefix }));
      count += 1;
    }
    feed.items = items;
    return filterObj(['link'], feed);
  });
  const feedPath = join(pathPrefix, RSS_PATH);
  console.log(`writing new xml to [${feedPath}]`);
  await writeFile(feedPath, newXml, { createDir: true });
  console.log(`xml file written to [${feedPath}]`);
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

    print(`Serving RSS feed at:
${url.href}
`);
    // call the func
    await func(url.href);

    // close the server
    await (new Promise(resolve => server.close(resolve)));
  },
  (pref) => `${pref}tmp-rss-feed`);
}

const DEFAULT_MAX_RSS_ITEMS_TO_MIRROR = 5;

export async function mirrorNamedRss (name, maxItems = DEFAULT_MAX_RSS_ITEMS_TO_MIRROR) {
  const url = TEST_URLS[name];
  console.log(`Creating a mirror of RSS feed for [${name}] from [${url}]`);
  const pathPrefix = join(MIRRORED_DIR, name);
  await saveRssToDiskFromUrl(url, { pathPrefix, maxItems });
}
