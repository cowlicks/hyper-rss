import Hypercore from 'hypercore';
import Parser from 'rss-parser';
import Corestore from 'corestore';
import { Items, itemsNotHyperized } from './items.js';
const parser = new Parser();

const urls = [
// 'https://www.reddit.com/.rss',
  'https://xkcd.com/rss.xml'
// 'https://feeds.soundcloud.com/users/soundcloud%3Ausers%3A211911700/sounds.rss'
];

const WRITER_STORAGE = './writer-storage';
const HRSS_STORE_PREFIX = 'hrss';
const HRSS_KEYS_STORE_SUFFIX = 'keys';
const HRSS_FEED_STORE_SUFFIX = 'feed';
const HRSS_BLOB_STORE_SUFFIX = 'blob';

function storeNames ({ prefix = HRSS_STORE_PREFIX, keysSuffix = HRSS_KEYS_STORE_SUFFIX, feedSuffix = HRSS_FEED_STORE_SUFFIX, blosbSuffix = HRSS_BLOB_STORE_SUFFIX } = {}) {
  return {
    keys: `${prefix}-${keysSuffix}`,
    feed: `${prefix}-${feedSuffix}`,
    blobs: `${prefix}-${blosbSuffix}`
  };
}

function getStores ({ storeageName = WRITER_STORAGE, ...rest } = {}) {
  const store = new Corestore(storeageName);
  const { keys: keysName, feed: feedName, blobs: blobsName } = storeNames({ ...rest });
  const keys = store.get({ name: keysName, valueEncoding: 'json' });
  const feed = store.get({ name: feedName });
  const blobs = store.get({ name: blobsName });
  return { keys, feed, blobs };
}

async function initWriterCores ({ ...opts } = {}) {
  const { keys, feed, blobs } = getStores({ ...opts });

  await Promise.all([keys.ready(), feed.ready(), blobs.ready()]);

  if (keys.length === 0) {
    await keys.append({
      keys: {
        feed: Buffer.from(feed.key).toString('base64'),
        blobs: Buffer.from(blobs.key).toString('base64')
      }
    });
  }
  return { keys, feed, blobs };
}

// async function initReaderCores({

(async () => {
  const { keys, feed, blobs } = await initWriterCores();
  console.log(keys.key.toString('base64'));
  console.log(keys.discoveryKey.toString('base64'));
})();
/*
(async () => {

  const core = new Hypercore(WRITER_STORAGE);
  await core.ready();
  const items = new Items({core});

  for (const url of urls) {
    let feed = await parser.parseURL(url);
    const missing = await itemsNotHyperized(feed.items, items.db);
    const batcher = items.db.batch();
    for (const {key, rssItem} of missing) {
      console.log(key, rssItem)
      await batcher.put(key, JSON.stringify(rssItem));
    }
    await batcher.flush();
  }

})();
*/
