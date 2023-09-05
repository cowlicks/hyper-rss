// TODO add a reader that can read our feed from the writer
import Hyperswarm from 'hyperswarm';
import Parser from 'rss-parser';
import Corestore from 'corestore';
import { itemsNotHyperized } from './items.js';
import Hyperbee from 'hyperbee';

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

function getBTreesFromCores ({ cores, ...opts }) {
  return {
    feed: new Hyperbee(cores.feed),
    blobs: new Hyperbee(cores.blobs)
  };
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

  return {
    store,
    swarm,
    cores: {
      keys, feed, blobs
    },
    bTrees: {
      feed: new Hyperbee(feed),
      blobs: new Hyperbee(blobs)
    }
  };
}

export class Writer {
  constructor (url, opts = {}) {
    const parser = new Parser();
    Object.assign(
      this,
      { url, opts, parser }
    );
  }

  async init () {
    const parsedRssFeed = await this.parser.parseURL(this.url);
    Object.assign(
      this,
      {
        ...(await initWriter(this.opts)),
        parsedRssFeed
      }
    );
  }

  async updateFeed () {
    const missing = await itemsNotHyperized(this.parsedRssFeed.items, this.bTrees.feed);
    await addMissing(this.bTrees.feed, missing);
    return missing;
  }
}

async function addMissing (feedBTree, missing) {
  const batcher = feedBTree.batch();

  for (const { key, rssItem } of missing) {
    console.log(`Adding item:
    key = [${key}]
`, rssItem);
    await batcher.put(key, JSON.stringify(rssItem));
  }
  await batcher.flush();
}

/* do some writing */
(async () => {
  for (const url of urls) {
    const writer = new Writer(url);
    await writer.init();
    const added = await writer.updateFeed();
    console.log(`Added [${added.length}] items`);
  }
})();
