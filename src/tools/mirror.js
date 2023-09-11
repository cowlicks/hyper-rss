import { join } from 'node:path';

import { getUrl, writeFile } from '../utils/index.js';
import { mkdir } from 'node:fs/promises';

import { DOWNLOAD_DIR_NAME, TEST_URLS } from '../const.js';
import { takeAll } from '../utils/async.js';
import Parser from 'rss-parser';

import * as cheerio from 'cheerio';

import express from 'express';

const rssLocation = (name) => join(DOWNLOAD_DIR_NAME, name);

export async function download (url) {
  const parts = await takeAll(getUrl(url));
  const buff = Buffer.concat(parts);
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

async function downloadAllTestUrls (testUrls) {
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
