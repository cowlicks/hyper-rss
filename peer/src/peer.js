import { OrderedHyperbee } from './feed.js';
import { KeyedBlobs } from './blobs.js';
import { takeAll } from './utils/async.js';
import { LoggableMixin } from '@hrss/utils';

// The base for reader's and writer's
export class Peer extends LoggableMixin {
  constructor (peerKind) {
    super();
    Object.assign(this, {
      extraPrefix: `[${peerKind}]`,
      peerKind,
    });
  }

  async ready ({ keys, feed, blobKeys, blobs }) {
    await Promise.all([
      keys.ready(),
      feed.ready(),
      blobKeys.ready(),
      blobs.ready(),
    ]);

    const feedBTree = new OrderedHyperbee(feed);
    const keyedBlobs = new KeyedBlobs(blobKeys, blobs);
    await keyedBlobs.init();

    return {
      cores: {
        keys,
        feed,
        blobKeys,
        blobs,
      },
      bTrees: {
        feed: feedBTree,
      },
      keyedBlobs,
    };
  }

  update ({ wait = true, ...options } = {}) {
    const opts = { wait, ...options };
    return Promise.all([
      this.cores.keys.update(opts),
      this.cores.feed.update(opts),
      this.cores.blobKeys.update(opts),
      this.cores.blobs.update(opts),
    ]);
  }

  async getMetadata (options) {
    return await this.bTrees.feed.getMetadata(options);
  }

  async getFeed (options) {
    return await takeAll(this.bTrees.feed.getFeedStream(options));
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
      this.keyedBlobs.close(),
    ]);
  }
}
