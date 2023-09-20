import * as cheerio from 'cheerio';

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

// TODO DRY these functions with tools/mirrors.js stuff

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

// TODO
async function maybeHandleEnclosure (item, { keyedBlobs } = {}) {
  // check if has enclosure
  if (!item.enclosure) {
    return item;
  }
  // download item.enclosure.url to buffer
  const newUrl = await _saveUrlToKeyedBlobs(item.enclosure.url, { keyedBlobs });
  // hash it and create new key/newUrl. See './tools/mirror.js'.saveUrlAsHash for url handling
  // insert into keyed blob store
  item.enclosure.url = newUrl;
  return item;
}

// TODO
async function maybeHandleImgContent (item, { keyedBlobs } = {}) {
  const c = cheerio.load(item.content, null, false);

  const imgElement = c('img');
  if (imgElement.length === 0) {
    return item;
  }

  const ogUrl = imgElement.attr('src');
  const newUrl = await _saveUrlToKeyedBlobs(ogUrl, { keyedBlobs });
  imgElement.attr('src', newUrl);

  item.content = c.html();

  return item;
}

// TODO use this when enclosure's and images are handled
export async function transformItem (item) {
  const item2 = maybeHandleEnclosure(item);
  const item3 = maybeHandleImgContent(item2);
  return item3;
}
