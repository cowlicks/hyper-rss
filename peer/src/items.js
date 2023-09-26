import * as cheerio from 'cheerio';
import { downloadToBuffer } from './utils/index.js';
import { createHash } from 'node:crypto';
import { ENCODING } from './const.js';

const defaultRssItemHasher = ({ guid }) => guid;

export async function itemsNotHyperized (rssFeed, hyperbeeItemsDb, { hasher = defaultRssItemHasher } = {}) {
  const out = [];
  await hyperbeeItemsDb.ready();
  for (const rssItem of [...rssFeed].reverse()) {
    const key = hasher(rssItem);
    if (!(await hyperbeeItemsDb.hasKey(key))) {
      out.push({ key, rssItem });
    }
  }
  return out;
}

export async function downloadAndHash (url, {
  hashAlgorithm = 'sha256',
  digestEncoding = ENCODING
}) {
  const buffer = await downloadToBuffer(url);
  const d = createHash(hashAlgorithm).update(buffer).digest();
  const hash = d.toString(digestEncoding);
  return { buffer, hash };
}

export async function downloadAndCreateFilename (url, { ...options }) {
  const { buffer, hash } = await downloadAndHash(url, { ...options });
  const parts = url.split('.');
  const extension = parts[parts.length - 1];
  const fileName = hash + (extension ? '.' + extension : '');
  return { buffer, hash, fileName };
}

// TODO create saveUrlToKeyedBlobs like saveUrlAsHash
async function saveUrlToKeyedBlobs (url, { keyedBlobs, ...options }) {
  const { buffer, fileName } = await downloadAndCreateFilename(url, { ...options });
  await keyedBlobs.maybePut(fileName, buffer);
  return fileName;
}

// Url handler sholud download and save the URL and return a new URL pointing to it
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

async function maybeHandleEnclosure (item, { keyedBlobs, ...options } = {}) {
  const out = itemEnclosureHandler(item, async (url) => {
    return saveUrlToKeyedBlobs(url, { keyedBlobs, ...options });
  });
  return out;
}

async function maybeHandleImgContent (item, { keyedBlobs, ...options } = {}) {
  const out = await itemImgHandler(item, async (url) => {
    return saveUrlToKeyedBlobs(url, { keyedBlobs, ...options });
  });
  return out;
}

// TODO use this when enclosure's and images are handled
export async function handleItem (item, { keyedBlobs, ...options }) {
  const item2 = await maybeHandleEnclosure(item, { keyedBlobs, ...options });
  const item3 = await maybeHandleImgContent(item2, { keyedBlobs, ...options });
  return item3;
}
