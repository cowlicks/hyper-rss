// Propagate keyed blobs cores through
import Parser from 'rss-parser';
import Corestore from 'corestore';
import Hyperbee from 'hyperbee';

import { base64FromBuffer, readJsonFile, writeJsonFile } from './utils/index.js';
import { log } from './log.js';
import { handleItem, itemsNotHyperized } from './items.js';
import { KeyedBlobs } from './blobs.js';
import { swarmInit } from './swarm.js';
import { Peer } from './peer.js';

const WRITER_STORAGE = './writer-storage';
const HRSS_STORE_PREFIX = 'hrss';
const HRSS_KEYS_STORE_SUFFIX = 'keys';
const HRSS_FEED_STORE_SUFFIX = 'feed';
const HRSS_BLOB_KEYS_STORE_SUFFIX = 'blobKeys';
const HRSS_BLOB_STORE_SUFFIX = 'blob';

const DEFAULT_WRITER_CONFIG_FILE_NAME = './writer-config.json';

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
  log.info(`Initializing Corestore at = [${storageName}]`);
  const store = new Corestore(storageName);
  return { store, storageName };
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
  const { store, ...storeRest } = getStore({ ...opts });
  const cores = getCores(store, { ...opts });
  return { store, cores, ...storeRest };
}

async function addItem (key, item, { feedBatcher, keyedBlobs }) {
  const item2 = await handleItem(item, { keyedBlobs });
  await feedBatcher.put(key, JSON.stringify(item2));
}

async function addMissing (missing, { feed, keyedBlobs }) {
  const feedBatcher = feed.batch();

  log.info(`# missing = [${missing.length}]`);
  for (const { key, rssItem } of missing) {
    await addItem(key, rssItem, { feedBatcher, keyedBlobs });
  }
  await Promise.all([feedBatcher.flush()]);
}

const fromConfigPropertyName = 'fromConfig';
function setFromConfig (o) {
  o[fromConfigPropertyName] = true;
}

function isFromConfig (o) {
  return !!o[fromConfigPropertyName];
}

// TODO rewrite this to use Keyed blobs
// TODO Writer should load URL from store if it exists. Otherwise we should
// only provide a URL for a brand new Writer
export class Writer extends Peer {
  static async fromConfig (configFileName = DEFAULT_WRITER_CONFIG_FILE_NAME) {
    const { url, ...opts } = await readJsonFile(configFileName);
    const writer = new Writer(url, { ...opts });
    setFromConfig(writer);
    return writer;
  }

  static async forNewUrl (url, opts) {
    return new Writer(url, opts);
  }

  constructor (url, { configFileName = DEFAULT_WRITER_CONFIG_FILE_NAME, ...opts } = {}) {
    super();
    log.info(`Creating writer for URL = [${url}]`);
    const parser = new Parser();
    Object.assign(
      this,
      { url, configFileName, opts, parser }
    );
  }

  async init () {
    const parsedRssFeed = await this.parser.parseURL(this.url);
    const { store, cores: { keys, feed, blobKeys, blobs }, ...storeAndCoreRest } = getStoreAndCores({ ...this.opts });

    const { cores, bTrees, keyedBlobs } = await this.ready({ keys, feed, blobKeys, blobs });

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

    Object.assign(
      this,
      {
        store,
        swarm,
        cores,
        bTrees,
        keyedBlobs,
        ...storeAndCoreRest,
        parsedRssFeed
      }
    );
    await this.maybeSaveConfig();
    return this;
  }

  getMissing () {
    return itemsNotHyperized(this.parsedRssFeed.items, this.bTrees.feed);
  }

  addNewItems (newItems) {
    return addMissing(newItems, { feed: this.bTrees.feed, keyedBlobs: this.keyedBlobs });
  }

  async updateFeed () {
    const missing = await this.getMissing();
    await this.addNewItems(missing);
    return missing;
  }

  discoveryKeyString () {
    return base64FromBuffer(this.cores.keys.key);
  }

  async maybeSaveConfig (...args) {
    if (isFromConfig(this)) {
      return;
    }
    await this.saveConfig(...args);
  }

  async saveConfig (configFileName = (this.configFileName ?? DEFAULT_WRITER_CONFIG_FILE_NAME)) {
    console.log('saving config to ', configFileName);
    return await writeJsonFile(configFileName, {
      url: this.url,
      storageName: this.storageName,
      discoveryKeyString: this.discoveryKeyString
    });
  }
}
