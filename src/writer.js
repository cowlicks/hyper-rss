import Hyperswarm from 'hyperswarm';
import Parser from 'rss-parser';
import Corestore from 'corestore';
import Hyperbee from 'hyperbee';

import goodbye from 'graceful-goodbye';

import { base64FromBuffer } from './utils/index.js';
import { log } from './log.js';
import { itemsNotHyperized } from './items.js';
import { getEnclosure } from './blobs.js';
import { swarmInit } from './swarm.js';
import { withTmpDir } from './test.js';

const WRITER_STORAGE = './writer-storage';
const HRSS_STORE_PREFIX = 'hrss';
const HRSS_KEYS_STORE_SUFFIX = 'keys';
const HRSS_FEED_STORE_SUFFIX = 'feed';
const HRSS_BLOB_KEYS_STORE_SUFFIX = 'blobKeys';
const HRSS_BLOB_STORE_SUFFIX = 'blob';

export function storeNames ({
  prefix = HRSS_STORE_PREFIX,
  keysSuffix = HRSS_KEYS_STORE_SUFFIX,
  feedSuffix = HRSS_FEED_STORE_SUFFIX,
  blobKeysSuffix = HRSS_BLOB_KEYS_STORE_SUFFIX,
  blosbSuffix = HRSS_BLOB_STORE_SUFFIX
} = {}) {
  return {
    keys: `${prefix}-${keysSuffix}`,
    feed: `${prefix}-${feedSuffix}`,
    blobKeys: `${prefix}-${blobKeysSuffix}`,
    blobs: `${prefix}-${blosbSuffix}`
  };
}

export function getStore ({ storageName = WRITER_STORAGE } = {}) {
  const store = new Corestore(storageName);
  return { store };
}

function getCores (store, { ...rest } = {}) {
  const { keys: keysName, feed: feedName, blobKeys: blobKeysName, blobs: blobsName } = storeNames({ ...rest });
  const keys = store.get({ name: keysName, valueEncoding: 'json' });
  const feed = store.get({ name: feedName });
  const blobKeys = store.get({ name: blobKeysName });
  const blobs = store.get({ name: blobsName });
  return { keys, feed, blobKeys, blobs };
}

export function getStoreAndCores ({ ...opts } = {}) {
  const { store } = getStore({ ...opts });
  const cores = getCores(store, { ...opts });
  return { store, cores };
}

async function initWriter ({ ...opts } = {}) {
  const { store, cores: { keys, feed, blobKeys, blobs } } = getStoreAndCores({ ...opts });

  await Promise.all([keys.ready(), feed.ready(), blobKeys.ready(), blobs.ready()]);

  const { swarm, peerDiscovery } = swarmInit(keys.discoveryKey, store);
  await peerDiscovery.flushed();

  if (keys.length === 0) {
    await keys.append({
      keys: {
        feed: base64FromBuffer(feed.key),
        blobKeys: base64FromBuffer(blobKeys.key),
        blobs: base64FromBuffer(blobs.key)
      }
    });
  }

  return {
    store,
    swarm,
    cores: {
      keys, feed, blobKeys, blobs
    },
    bTrees: {
      feed: new Hyperbee(feed),
      blobKeys: new Hyperbee(blobKeys),
      blobs: new Hyperbee(blobs)
    }
  };
}

async function addItem (key, item, feedBatcher, _blobsBatcher) {
  if (item.enclosure) {
    const _data = await getEnclosure(item.enclosure);
  }
  await feedBatcher.put(key, JSON.stringify(item));
}

async function addMissing (missing, { feed, blobKeys: _, blobs }) {
  const feedBatcher = feed.batch();
  const blobsBatcher = blobs.batch();

  log.info(`# missing = [${missing.length}]`);
  for (const { key, rssItem } of missing) {
    await addItem(key, rssItem, feedBatcher, blobsBatcher);
  }
  await Promise.all([feedBatcher.flush(), blobsBatcher.flush()]);
}

// TODO rewrite this to use Keyed blobs
export class Writer {
  constructor (url, opts = {}) {
    log.info(`Creating writer for URL = [${url}]`);
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
    return this;
  }

  getMissing () {
    return itemsNotHyperized(this.parsedRssFeed.items, this.bTrees.feed);
  }

  addNewItems (newItems) {
    return addMissing(newItems, this.bTrees);
  }

  async updateFeed () {
    const missing = await this.getMissing();
    await this.addNewItems(missing);
    return missing;
  }

  discoveryKeyString () {
    return base64FromBuffer(this.cores.keys.key);
  }
}

export async function _testUpdateWriterIntegration (tmpd) {
  const url = 'https://xkcd.com/rss.xml';
  const writer = new Writer(url, { storageName: tmpd });
  await writer.init();
  await writer.updateFeed();
  return writer.discoveryKeyString();
}

// (async () => await withTmpDir(async (tmpd) => await _testUpdateWriterIntegration(tmpd)))();
