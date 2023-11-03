// Propagate keyed blobs cores through
import Parser from 'rss-parser';
import Corestore from 'corestore';

import { encodedStrFromBuffer, readJsonFile, writeJsonFile } from './utils/index.js';
import { log } from '@hrss/utils';
import { handleItem, itemsNotHyperized } from './items.js';
import { swarmInit } from './swarm.js';
import { Peer } from './peer.js';
import { RSS_METADATA_FIELDS, WRITER_PEER_KIND } from './const.js';

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
  blosbSuffix = HRSS_BLOB_STORE_SUFFIX,
} = {}) {
  return {
    keys: `${prefix}-${keysSuffix}`,
    feed: `${prefix}-${feedSuffix}`,
    blobKeys: `${prefix}-${blobKeysSuffix}`,
    blobs: `${prefix}-${blosbSuffix}`,
  };
}

export function getStore ({ storageName = WRITER_STORAGE } = {}) {
  log.info(`Initializing Corestore at = [${storageName}]`);
  const store = new Corestore(storageName);
  log.info(`Created Corestore at = [${storageName}]`);
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
  return { cores, store, ...storeRest };
}

const fromConfigPropertyName = 'fromConfig';
function setFromConfig (o) {
  o[fromConfigPropertyName] = true;
}

function isFromConfig (o) {
  return !!o[fromConfigPropertyName];
}

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
    super(WRITER_PEER_KIND);
    const parser = new Parser();
    Object.assign(
      this,
      { url, configFileName, opts, parser },
    );
    this.log(`Created for URL = [${url}]`);
  }

  async init () {
    const parsedRssFeed = await this.parser.parseURL(this.url);
    const { store, cores, ...storeAndCoreRest } = getStoreAndCores({ ...this.opts });
    const { keys, blobKeys, blobs } = cores;

    const { feed, keyedBlobs } = await this.ready(cores);
    this.log('Cores made ready');

    const { swarm, peerDiscovery } = swarmInit(keys.discoveryKey, store);
    await peerDiscovery.flushed();
    this.log('Peer discovery flushed');

    if (keys.length === 0) {
      await keys.append({
        keys: {
          feed: encodedStrFromBuffer(feed.key),
          blobKeys: encodedStrFromBuffer(blobKeys.key),
          blobs: encodedStrFromBuffer(blobs.key),
        },
      });
    }

    Object.assign(
      this,
      {
        store,
        swarm,
        cores,
        feed,
        keyedBlobs,
        ...storeAndCoreRest,
        parsedRssFeed,
      },
    );
    await this.maybeSaveConfig();
    return this;
  }

  getMissing () {
    return itemsNotHyperized(this.parsedRssFeed.items, this.feed);
  }

  async addNewItems (newItems) {
    this.log(`# new items = [${newItems.length}]`);
    for (const { key, rssItem } of newItems) {
      const handled = await handleItem(rssItem, { keyedBlobs: this.keyedBlobs });
      await this.feed.putOrderdItem(key, JSON.stringify(handled));
    }
  }

  async updateMetadata () {
    for (const field of RSS_METADATA_FIELDS) {
      const value = this.parsedRssFeed[field];
      if (typeof value !== 'undefined') {
        await this.feed.maybeUpdateMetadata(field, JSON.stringify(value));
      }
    }
  }

  async updateFeed () {
    const missing = await this.getMissing();
    await this.addNewItems(missing);
    await this.updateMetadata();
    return missing;
  }

  discoveryKeyString () {
    return encodedStrFromBuffer(this.cores.keys.key);
  }

  async maybeSaveConfig (...args) {
    if (isFromConfig(this)) {
      return;
    }
    await this.saveConfig(...args);
  }

  async saveConfig (configFileName = (this.configFileName ?? DEFAULT_WRITER_CONFIG_FILE_NAME)) {
    this.log('saving config to ', configFileName);
    return await writeJsonFile(configFileName, {
      url: this.url,
      storageName: this.storageName,
      discoveryKeyString: this.discoveryKeyString,
    });
  }
}
