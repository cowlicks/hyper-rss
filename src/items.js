import * as cheerio from 'cheerio';
import { downloadToBuffer, noop } from './utils/index.js';
import { createHash } from 'node:crypto';

const defaultRssItemHasher = ({ guid }) => guid;

export async function itemsNotHyperized (rssFeed, hyperbeeItemsDb, { hasher = defaultRssItemHasher } = {}) {
  const out = [];
  await hyperbeeItemsDb.ready();
  const batcher = hyperbeeItemsDb.batch();

  for (const rssItem of [...rssFeed].reverse()) {
    const key = hasher(rssItem);
    const hyperItemRes = await batcher.get(key);
    if (hyperItemRes === null) {
      out.push({ key, rssItem });
    }
  }
  await batcher.flush();
  return out;
}

export async function downloadAndHash (url, { hashAlgorithm = 'sha256', digestEncoding = 'base64', ...options }) {
  const buffer = await downloadToBuffer(url);
  const d = createHash(hashAlgorithm).update(buffer).digest();
  const hash = d.toString(digestEncoding);
  return { buffer, hash };
}

// TODO create saveUrlToKeyedBlobs like saveUrlAsHash
async function _saveUrlToKeyedBlobs (url, { keyedBlobs: _ }) {
  // TODO
  return url;
}

export async function itemEnclosureHandler (item, urlHandler) {
  if (!item.enclosure) {
    return item;
  }

  const newUrl = await urlHandler(item.enclosure.url, item);
  item.enclosure.url = newUrl;

  return item;
}

export async function itemImgHandler (item, urlHandler) {
  const c = cheerio.load(item.content, null, false);

  const imgElement = c('img');
  if (imgElement.length === 0) {
    return item;
  }

  const ogUrl = imgElement.attr('src');
  const newUrl = await urlHandler(ogUrl, item);
  imgElement.attr('src', newUrl);

  item.content = c.html();

  return item;
}

// TODO
async function maybeHandleEnclosure (item, { keyedBlobs } = {}) {
  const out = itemEnclosureHandler(item, (url) => {
    return url;
  });
  return out;
}

// TODO
async function maybeHandleImgContent (item, { keyedBlobs } = {}) {
  const out = itemImgHandler(item, noop);
  return out;
}

// TODO use this when enclosure's and images are handled
export async function handleItem (item) {
  const item2 = maybeHandleEnclosure(item);
  const item3 = maybeHandleImgContent(item2);
  return item3;
}
