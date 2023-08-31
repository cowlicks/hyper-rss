import Hypercore from 'hypercore';
import Hyperswarm from 'hyperswarm';
import Parser from 'rss-parser';
import Corestore from 'corestore';
import { Items, itemsNotHyperized } from './items.js';
import { getOnExit } from './utils.js';
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

function getStore ({ storeageName = WRITER_STORAGE } = {}) {
  const store = new Corestore(storeageName);
  return { store };
}

function getCores (store, { ...rest } = {}) {
  const { keys: keysName, feed: feedName, blobs: blobsName } = storeNames({ ...rest });
  const keys = store.get({ name: keysName, valueEncoding: 'json' });
  const feed = store.get({ name: feedName });
  const blobs = store.get({ name: blobsName });
  return { keys, feed, blobs };
}

function getStoreAndCores ({ ...opts }) {
  const { store } = getStore({ ...opts });
  const cores = getCores(store, { ...opts });
  return { store, cores };
}

async function initWriter ({ ...opts } = {}) {
  const { store, cores: { keys, feed, blobs } } = getStoreAndCores({ ...opts });

  await Promise.all([keys.ready(), feed.ready(), blobs.ready()]);

  const swarm = new Hyperswarm();
  swarm.join(keys.discoveryKey);
  swarm.on('connection', conn => store.replicate(conn));

  if (keys.length === 0) {
    await keys.append({
      keys: {
        feed: Buffer.from(feed.key).toString('base64'),
        blobs: Buffer.from(blobs.key).toString('base64')
      }
    });
  }
  return { store, swarm, cores: { keys, feed, blobs } };
}

(async () => {
  const { store, swarm, cores } = await initWriter();

  const items = new Items({ core: cores.feed });

  for (const url of urls) {
    const feed = await parser.parseURL(url);
    const missing = await itemsNotHyperized(feed.items, items.db);
    const batcher = items.db.batch();
    for (const { key, rssItem } of missing) {
      console.log(key, rssItem);
      await batcher.put(key, JSON.stringify(rssItem));
    }
    await batcher.flush();
  }
})();
