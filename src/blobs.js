import { AsyncQueue } from './utils.js';

import https from 'https';
import Hyperbee from 'hyperbee';
import Hyperblobs from 'hyperblobs';
import { getStore, getStoreAndCores, storeNames } from './writer.js';
import { withTmpDir, assert } from './test.js';

/* Gets bytes from a url as an async iterable. Follows redirects */
function getUrl (url) {
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
async function _testkeyblobs (path) {
  const key = 'foobar',
    buff = Buffer.from('Hello, world!');

  const { cores: { blobKeys, blobs } } = getStoreAndCores({ storeageName: path });
  const kb = new KeyedBlobs(blobKeys, blobs);
  await kb.init();
  await kb.put(key, buff);
  const gotten = await kb.get(key);
  assert(gotten.toString(), buff);
}

async function _testFromStoreKeyBlobs (tmpd) {
  const key = 'foobar',
    buff = Buffer.from('Hello, world!');
  const { store } = getStore({ storageName: tmpd });
  console.log(store);
  const kb = KeyedBlobs.fromStore(store);
  await kb.init();
  await kb.put(key, buff);
  const gotten = await kb.get(key);
  assert(gotten.toString(), buff.toString());
}

// (async () => await withTmpDir((tmpd) => _testkeyblobs(tmpd)))();
(async () => await withTmpDir((tmpd) => _testFromStoreKeyBlobs(tmpd)))();
