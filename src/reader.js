import Corestore from 'corestore';
import goodbye from 'graceful-goodbye';
import Hyperbee from 'hyperbee';
import Hyperswarm from 'hyperswarm';
import { KeyedBlobs } from './blobs.js';
import { log } from './log.js';
import { bufferFromBase64 } from './utils/index.js';

const READER_STORAGE = './reader-storage';

export class Reader {
  constructor (discoveryKeyString) {
    log.info(`Creating Reader for discovery key = [${discoveryKeyString}]`);
    Object.assign(
      this,
      {
        discoveryKeyString,
        discoveryKey: bufferFromBase64(discoveryKeyString)
      });
  }

  async init ({ storageName = READER_STORAGE, ...opts } = {}) {
    log.info(`Initializing Reader with storage at = [${storageName}]`);

    const swarm = new Hyperswarm({ ...opts });
    goodbye(() => swarm.destroy());
    const store = new Corestore(storageName);

    swarm.on('connection', conn => store.replicate(conn));

    const keysCore = store.get({ key: this.discoveryKey, valueEncoding: 'json' });
    await keysCore.ready();

    const foundPeers = store.findingPeers();
    swarm.join(keysCore.discoveryKey);
    await swarm.flush();
    foundPeers();
    await keysCore.update();

    if (keysCore.length === 0) {
      console.error('Could not connect to the writer peer');
      process.exit(1);
    }

    const {
      keys
    } = await keysCore.get(0);

    const feedCore = store.get({ key: bufferFromBase64(keys.feed) });
    const blobKeysCore = store.get({ key: bufferFromBase64(keys.blobKeys) });
    const blobsCore = store.get({ key: bufferFromBase64(keys.blobs) });

    await Promise.all([feedCore.ready(), blobKeysCore.ready(), blobsCore.ready()]);

    const feedBTree = new Hyperbee(feedCore);
    const blobsKeysBTree = new Hyperbee(blobKeysCore);
    const blobsBTree = new Hyperbee(blobsCore);

    const keyedBlobs = new KeyedBlobs(blobKeysCore, blobsCore);
    await keyedBlobs.init();

    Object.assign(
      this,
      {
        store,
        swarm,
        cores: {
          keys: keysCore,
          feed: feedCore,
          blobKeys: blobKeysCore,
          blobs: blobsCore
        },
        bTrees: {
          feed: feedBTree,
          blobKeys: blobsKeysBTree,
          blobs: blobsBTree
        },
        keyedBlobs,
        storageName
      }
    );
    return this;
  }

  async close () {
    await Promise.all([
      this.swarm.destroy(),
      this.store.close(),
      this.cores.keys.close(),
      this.cores.feed.close(),
      this.cores.blobKeys.close(),
      this.cores.blobs.close(),
      this.bTrees.feed.close(),
      this.bTrees.blobKeys.close(),
      this.bTrees.blobs.close(),
      this.keyedBlobs.close()
    ]);
  }
}
