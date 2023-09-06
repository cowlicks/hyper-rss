import { AsyncQueue } from './utils.js';

import https from 'https';
import Hyperbee from 'hyperbee';
import Hyperblobs from 'hyperblobs';

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
class KeyedBlobs {
  constructor (keyCore, blobsCore) {
    Object.assign(this, {
      keys: new Hyperbee(keyCore),
      blobs: new Hyperblobs(blobsCore),
      cores: {
        keyCore, blobsCore
      }
    });
  }

  async put (key, blob, { blobsOpts, beeOpts } = {}) {
    const id = await this.blobs.put(blob, blobsOpts);
    await this.keys.put(key, id, beeOpts);
  }

  async get (key, { blobsOpts, beeOpts } = {}) {
    const { seq: _, value: id } = await this.keys.get(key, beeOpts);
    const blob = await this.blobs.get(id, blobsOpts);
    return blob;
  }
}
