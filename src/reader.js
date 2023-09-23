import Corestore from 'corestore';
import goodbye from 'graceful-goodbye';
import Hyperswarm from 'hyperswarm';
import { log } from './log.js';
import { bufferFromBase64 } from './utils/index.js';
import { Peer } from './peer.js';
import { READER_PEER_KIND } from './const.js';

const READER_STORAGE = './reader-storage';

export class Reader extends Peer {
  constructor (discoveryKeyString) {
    log.info(`Creating Reader for discovery key = [${discoveryKeyString}]`);
    super(READER_PEER_KIND);
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
