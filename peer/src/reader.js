import Corestore from 'corestore';
import goodbye from 'graceful-goodbye';
import Hyperswarm from 'hyperswarm';
import { bufferFromEncodedStr } from './utils/index.js';
import { Peer } from './peer.js';
import { READER_PEER_KIND } from './const.js';

const READER_STORAGE = './reader-storage';

export class Reader extends Peer {
  constructor (discoveryKeyString) {
    super(READER_PEER_KIND);
    this.log(`Creating Reader for discovery key = [${discoveryKeyString}]`);
    Object.assign(
      this,
      {
        discoveryKeyString,
        discoveryKey: bufferFromEncodedStr(discoveryKeyString)
      });
  }

  async init ({ storageName = READER_STORAGE, ...opts } = {}) {
    this.log(`Initializing Reader with storage at = [${storageName}]`);

    const swarm = new Hyperswarm({ ...opts });
    goodbye(() => swarm.destroy());
    const store = new Corestore(storageName);
    this.log(`Loaded store from = [${storageName}]`);

    swarm.on('connection', conn => store.replicate(conn));

    const keysCore = store.get({ key: this.discoveryKey, valueEncoding: 'json' });
    this.log('waiting for keys to be ready');
    await keysCore.ready();

    const foundPeers = store.findingPeers();
    swarm.join(keysCore.discoveryKey);
    swarm.flush().then(() => foundPeers());
    // waits till we find first peer or flush is complete
    await keysCore.get(0);
    await keysCore.update({ wait: true });

    if (keysCore.length === 0) {
      console.error('Could not connect to the writer peer');
      process.exit(1);
    }

    const {
      keys
    } = await keysCore.get(0);

    const feedCore = store.get({ key: bufferFromEncodedStr(keys.feed) });
    const blobKeysCore = store.get({ key: bufferFromEncodedStr(keys.blobKeys) });
    const blobsCore = store.get({ key: bufferFromEncodedStr(keys.blobs) });

    Object.assign(
      this,
      {
        store,
        swarm,
        ...(await this.ready({
          keys: keysCore,
          feed: feedCore,
          blobKeys: blobKeysCore,
          blobs: blobsCore
        })),
        storageName
      }
    );
    return this;
  }
}
