import { AsyncQueue } from './utils/index.js';

import https from 'https';
import Hyperbee from 'hyperbee';
import Hyperblobs from 'hyperblobs';
import { getStore, getStoreAndCores, storeNames } from './writer.js';

/* Gets bytes from a url as an async iterable. Follows redirects */
export function getUrl (url) {
  const queue = new AsyncQueue();
  https.get(url, res => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      (async () => {
        await queue.addAsyncIter(getUrl(res.headers.location));
        queue.done();
      })();
      return;
    }
    res.on('data', chunk => {
      queue.push(chunk);
    });
    res.on('end', () => {
      queue.done();
    });
  });
  return queue;
}

// TODO rewrite url in the enclosure to anonymize it
export async function getEnclosure (enclosure) {
  const chunks = [];
  for await (const chunk of getUrl(enclosure.url)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export class KeyedBlobs {
  static fromStore (store, { ...rest } = {}) {
    const { blobKeys: blobKeysName, blobs: blobsName } = storeNames({ ...rest });
    const blobKeys = store.get({ name: blobKeysName });
    const blobs = store.get({ name: blobsName });
    return new KeyedBlobs(blobKeys, blobs);
  }

  constructor (blobKeysCore, blobsCore) {
    Object.assign(this, {
      cores: {
        blobKeys: blobKeysCore,
        blobs: blobsCore
      }
    });
  }

  async init () {
    await Promise.all([this.cores.blobKeys.ready(), this.cores.blobs.ready()]);
    Object.assign(
      this,
      {
        keys: new Hyperbee(this.cores.blobKeys),
        blobs: new Hyperblobs(this.cores.blobs)
      });
  }

  async put (key, blob, { blobsOpts, beeOpts } = {}) {
    const id = await this.blobs.put(blob, blobsOpts);
    await this.keys.put(key,
      JSON.stringify(id),
      beeOpts);
    return id;
  }

  async get (key, { blobsOpts, beeOpts } = {}) {
    const { seq: _, value: rawValue } = await this.keys.get(key, beeOpts);
    const id = JSON.parse(rawValue.toString());
    const blob = await this.blobs.get(id, blobsOpts);
    return blob;
  }
}
