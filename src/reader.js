import Corestore from 'corestore';
import goodbye from 'graceful-goodbye';
import Hyperbee from 'hyperbee';
import Hyperswarm from 'hyperswarm';
import { base64FromBuffer, bufferFromBase64 } from './utils.js';

const READER_STORAGE = './reader-storage';

class Reader {
  constructor (discoveryKeyString) {
    Object.assign(
      this,
      {
        discoveryKeyString,
        discoveryKey: bufferFromBase64(discoveryKeyString)
      });
  }

  async init ({ storageName = READER_STORAGE, ...opts } = {}) {
    const swarm = new Hyperswarm();
    goodbye(() => swarm.destroy());
    const store = new Corestore(storageName);

    swarm.on('connection', conn => store.replicate(conn));

    const keysCore = store.get({ key: this.discoveryKey, valueEncoding: 'json' });
    await keysCore.ready();

    const foundPeers = store.findingPeers();
    swarm.join(keysCore.discoveryKey);
    swarm.flush().then(() => foundPeers());
    await keysCore.update();

    if (keysCore.length === 0) {
      console.log('Could not connect to the writer peer');
      process.exit(1);
    }

    const {
      keys
    } = await keysCore.get(0);

    const feedCore = store.get({ key: bufferFromBase64(keys.feed) });
    const blobsCore = store.get({ key: bufferFromBase64(keys.blobs) });

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
        }
      }
    );
    return this;
  }
}

(async () => {
  const key = 'goo9i6uXyPJck7vaY+oz/afEqgc9BBRUSn7n6XwVZEg=';
  const reader = new Reader(key);
  await reader.init();
  const stream = reader.bTrees.feed.createReadStream({}, { reverse: true });
  for await (const s of stream) {
    console.log(JSON.parse(s.value.toString()));
  }
})();
