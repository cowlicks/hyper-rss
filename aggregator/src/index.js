import { Reader } from '../../peer/src/index.js';
import { mkdir } from 'node:fs/promises';

//  /* adds a reader and starts it */
//  addReader(discoveryKeyString, { storageDir })
//  /* gets a list of items from  a reader */
//  getReaderFeed(dk, { limit, ...opts })
//  /* get a metadata from a reader */
//  getReaderMetadata(dk, opts)
//  /* get a binary blob from a reader */
//  getReaderBlob(dk, url, opts)
//  /* tell the reader to update */
//  updateReader(opts)
//  /* stops a reader */
//  stopReader(opts)
//  /* starts a reader */
//  startReader(opts)
//  /* delete a reader and it's data */
//  deleteReader(opts)
//  /* list readers with their metadata */
//  listReaders({ limit, ...opts })
//
//  /* initialize the Aggregator. Loads from storage. Starts readers */
//  What data do we need to store?
//  A list of readers.
//  Each reader needs it's own config directory

import { join } from 'node:path';
import { listDirectories } from './utils.js';
import { fileExists } from '../../peer/src/utils/index.js';
import { LoggableMixin } from '@hrss/utils';
import { addInvalidationOnObjectMethod, ApiCache, cacheMethodOnObject } from './cache.js';

const CACHEABLE = [
  { methodName: 'getReaderFeed' },
  { methodName: 'getReaderMetadata' },
  { methodName: 'getReaderBlob' },
];

const invalidateBasedOnDiscoveryKey = (discoveryKeyString) => new RegExp(discoveryKeyString);

const CACHE_INVALIDATES = [
  { methodName: '_removeReader', makeRegex: invalidateBasedOnDiscoveryKey },
  { methodName: 'addReader', makeRegex: invalidateBasedOnDiscoveryKey },
  { methodName: 'updateReader', makeRegex: invalidateBasedOnDiscoveryKey },
  { methodName: 'stopReader', makeRegex: () => /.*?/ },
  { methodName: 'init', makeRegex: () => /.*?/ },
];

export const Aggregator = LoggableMixin(class Aggregator {
  static cacheMethods (instance, cache = new ApiCache()) {
    for (const { methodName } of CACHEABLE) {
      cacheMethodOnObject(cache, instance, methodName);
    }

    for (const { methodName, makeRegex } of CACHE_INVALIDATES) {
      addInvalidationOnObjectMethod(cache, instance, methodName, makeRegex);
    }
  }

  constructor ({ storageName = './aggregator-storage' } = {}) {
    Object.assign(
      this,
      {
        storageName,
        readers: new Map(),
      },
    );
  }

  async init () {
    if (!fileExists(this.storageName)) {
      await mkdir(this.storageName, { recursive: true });
    }

    const readerDirs = await listDirectories(this.storageName);
    await Promise.all(readerDirs.map(r => this.addReader(r)));
  }

  _getReader (discoveryKeyString) {
    return this.readers.get(discoveryKeyString);
  }

  _removeReader (discoveryKeyString) {
    this.readers.delete(discoveryKeyString);
  }

  async addReader (discoveryKeyString) {
    const readerStorageName = join(this.storageName, discoveryKeyString);
    const reader = new Reader(discoveryKeyString);
    await reader.init({ storageName: readerStorageName });
    this.readers.set(discoveryKeyString, reader);
  }

  getReaderFeed (discoveryKeyString, options) {
    return this._getReader(discoveryKeyString).getFeed(options);
  }

  getReaderMetadata (discoveryKeyString) {
    return this._getReader(discoveryKeyString).getMetadata();
  }

  getReaderBlob (discoveryKeyString, url, options) {
    return this._getReader(discoveryKeyString).getBlob(url, options);
  }

  getReaderBlobId (discoveryKeyString, url, options) {
    return this._getReader(discoveryKeyString).getBlobId(url, options);
  }

  getReaderBlobRange (discoveryKeyString, blobId, range, options) {
    return this._getReader(discoveryKeyString).getBlobRange(blobId, range, options);
  }

  updateReader (discoveryKeyString, options = {}) {
    return this._getReader(discoveryKeyString).update(options);
  }

  async stopReader (discoveryKeyString) {
    await this._getReader(discoveryKeyString).close();
    this._removeReader(discoveryKeyString);
  }

  async close () {
    return Promise.all([...[...this.readers.keys()].map(dks => this.stopReader(dks))]);
  }

  async getFeedsMetadata (options) {
    return Promise.all(
      [...this.readers.entries()].map(([key, reader]) => {
        return reader.getMetadata(options).then(result => [key, result]);
      }),
    );
  }
});
