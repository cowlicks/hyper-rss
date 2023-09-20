import Corestore from 'corestore';
import goodbye from 'graceful-goodbye';
import Hyperbee from 'hyperbee';
import Hyperswarm from 'hyperswarm';
import { log } from './log.js';
import { bufferFromBase64 } from './utils/index.js';

const READER_STORAGE = './reader-storage';

class Reader {
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
    const blobsCore = store.get({ key: bufferFromBase64(keys.blobs) });

    // TODO is this needed???
    await Promise.all([feedCore.ready(), blobsCore.ready()]);
    await Promise.all([feedCore.update(), blobsCore.update()]);

    const feedBTree = new Hyperbee(feedCore);
    const blobsBTree = new Hyperbee(blobsCore);

    Object.assign(
      this,
      {
        store,
        swarm,
        cores: {
          keys: keysCore,
          feed: feedCore,
          blobs: blobsCore
        },
        bTrees: {
          feed: feedBTree,
          blobs: blobsBTree
        },
        storageName
      }
    );
    return this;
  }

  async close () {
    await Promise.all([
      this.cores.keys.close(),
      this.cores.feed.close(),
      // this.cores.blobKeys.close(),
      this.cores.blobs.close(),
      this.bTrees.feed.close(),
      // this.bTrees.blobKeys.close(),
      this.bTrees.blobs.close(),
      this.swarm.destroy(),
      this.store.close()
    ]);
  }
}

export async function _testReaderIntegration (tmpd, discoveryKeyString) {
  const reader = new Reader(discoveryKeyString);
  await reader.init({ storageName: tmpd });
  await reader.bTrees.feed.update({ wait: true });

  const stream = reader.bTrees.feed.createReadStream({}, { reverse: true });
  const out = [];
  for await (const s of stream) {
    out.push(JSON.parse(s.value.toString()));
  }
  if (out.length === 0) {
    throw new Error('no stream parts found!!!!');
  }
  await reader.close();
  return out;
}
