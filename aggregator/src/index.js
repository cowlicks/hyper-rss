import { Reader } from '../../peer/src/index.js';
import { mkdir } from 'node:fs/promises';

//  /* adds a reader and starts it */
//  addReader(discoveryKeyString, { storageDir })
//  /* gets a list of items from  a reader */
//  getReaderFeed(dk, { limit, ...opts })
//  /* get a binary blob from a reader */
//  getBlob(dk, url, opts)
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

export class Aggregator {
  constructor ({ storageName = './aggregator-storage' } = {}) {
    Object.assign(
      this,
      {
        storageName,
        readers: new Map()
      }
    );
  }

  async init () {
    if (!fileExists(this.storageName)) {
      await mkdir(this.storageName, { recursive: true });
    }

    const readerDirs = await listDirectories(this.storageName);
    // TODO
    // iterate over reader dirs and intialize them
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

  getReaderFeed (discoveryKeyString) {
    return this._getReader(discoveryKeyString).getFeed();
  }

  getBlob (discoveryKeyString, url) {
    return this._getReader(discoveryKeyString).get(url);
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

  async getFeedsMetadata () {
    return Promise.all([...this.readers.values()].map((r) => r.getMetadata()));
  }
}
