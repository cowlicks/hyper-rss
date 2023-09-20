import Hyperbee from 'hyperbee';
import Hyperblobs from 'hyperblobs';
import { storeNames } from './writer.js';
import { getUrl } from './utils/index.js';
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

  async close () {
    await Promise.all([
      this.cores.blobKeys.close(),
      this.cores.blobs.close(),
      this?.keys?.close(),
      this?.blosbs?.close()
    ]);
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
