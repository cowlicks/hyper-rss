import Hyperbee from 'hyperbee';
import Hyperblobs from 'hyperblobs';
import { storeNames } from './writer.js';
import { takeAll } from './utils/async.js';
import { LoggableMixin } from '@hrss/utils';

const idFromGetKeyResult = ({ value }) => JSON.parse(value.toString());

export const KeyedBlobs = LoggableMixin(class KeyedBlobs {
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
        blobs: blobsCore,
      },
    });
  }

  async close () {
    await Promise.all([
      this.cores.blobKeys.close(),
      this.cores.blobs.close(),
      this?.keys?.close(),
      this?.blosbs?.close(),
    ]);
  }

  async init () {
    await Promise.all([this.cores.blobKeys.ready(), this.cores.blobs.ready()]);
    Object.assign(
      this,
      {
        keys: new Hyperbee(this.cores.blobKeys),
        blobs: new Hyperblobs(this.cores.blobs),
      });
  }

  async put (key, blob, { blobsOpts, beeOpts } = {}) {
    const id = await this.blobs.put(blob, blobsOpts);
    await this.keys.put(key,
      JSON.stringify(id),
      beeOpts);
    return id;
  }

  async maybePut (key, blob, { ...options } = {}) {
    if (await this.keys.get(key)) {
      return null;
    }
    return this.put(key, blob, { ...options });
  }

  keyStream () {
    return this.keys.createReadStream();
  }

  async getKeys () {
    return takeAll(this.keyStream());
  }

  async getKeysAndBlobs ({ beeOpts = {}, blobsOpts = {} } = {}) {
    const keys = await this.getKeys();
    const keysToIds = keys.map(key => [key, idFromGetKeyResult(key, { ...beeOpts })]);
    return Promise.all(
      keysToIds.map(async ([key, id]) => [key, await this.blobs.get(id, { ...blobsOpts })]),
    );
  }

  async get (key, { beeOpts = {}, blobsOpts = {} } = {}) {
    this.log(`Get blob with key [${key}]`);
    const id = await this.getId(key, { beeOpts });
    const blob = await this.blobs.get(id, blobsOpts);
    return blob;
  }

  async getId (key, { beeOpts = {} } = {}) {
    return idFromGetKeyResult(await this.keys.get(key, beeOpts));
  }

  async getRange (id, { start, end }, { blobsOpts = {} } = {}) {
    this.log(`Get blob with ID [${id}]`);
    const blob = await this.blobs.get(id, { ...blobsOpts, start, end });
    return blob;
  }
});
