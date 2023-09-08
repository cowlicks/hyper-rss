import { getUrl, writeFile } from '../utils/index.js';

import { TEST_URLS } from '../const.js';
import { takeAll } from '../utils/async.js';
import Parser from 'rss-parser';

import * as cheerio from 'cheerio';

export async function download (url) {
  const parts = await takeAll(getUrl(url));
  const buff = Buffer.concat(parts);
  return buff.toString();
}

export async function writeFromUrl (fileName, url) {
  const str = await download(url);
  await writeFile(fileName, str);
}
export async function mirrorRss (url) {
  const parse = new Parser();
  const parsed = await parse.parseURL(url);
  return parsed;
}

(async () => {
  const url = TEST_URLS.xkcd;
  // const url = TEST_URLS.skeptoid;
  const p = await mirrorRss(url);
  for (const item of p.items) {
    const selector = cheerio.load(item.content);
    const img = selector('img');
    /// test selecting items
    // TODO get this working
    console.log(img.html());
  }
})();
