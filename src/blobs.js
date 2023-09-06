import { AsyncQueue } from './utils.js';

import https from 'https';
import Hyperbee from 'hyperbee';
import Hyperblobs from 'hyperblobs';
import { getStoreAndCores } from './writer.js';

import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

// TESTME
export class KeyedBlobs {
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

const TMP_DIR_PREFIX = 'hrss-test-';

async function withTmpDir (func, prefix = TMP_DIR_PREFIX) {
  let tmpd;
  try {
    tmpd = await mkdtemp(join(tmpdir(), prefix));
    console.log('SET TMP DIR TO', tmpd);
    await func(tmpd);
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    console.log('FINALLY BLOCK', console.log(tmpd));
    if (tmpd) {
      await rm(tmpd, { recursive: true, force: true });
    }
  }
}

async function _testkeyblobs (path) {
  const key = 'foobar',
    buff = Buffer.from('Hello, world!');

  const { cores: { blobKeys, blobs } } = getStoreAndCores({ storeageName: path });
  const kb = new KeyedBlobs(blobKeys, blobs);
  await kb.init();
  const res = await kb.put(key, buff);
  console.log(res);
  const gotten = await kb.get(key);
  console.log(gotten.toString());
}

(async () => await withTmpDir((tmpd) => _testkeyblobs(tmpd)))();
