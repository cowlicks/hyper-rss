import Hyperbee from 'hyperbee';
import { KeyedBlobs } from './blobs.js';
import { takeAll } from './utils/async.js';

// The base for reader's and writer's
export class Peer {
  async ready ({ keys, feed, blobKeys, blobs }) {
    await Promise.all([
      keys.ready(),
      feed.ready(),
      blobKeys.ready(),
      blobs.ready()
    ]);

    const feedBTree = new Hyperbee(feed);
    const keyedBlobs = new KeyedBlobs(blobKeys, blobs);
    await keyedBlobs.init();

    return {
      cores: {
        keys,
        feed,
        blobKeys,
        blobs
      },
      bTrees: {
        feed: feedBTree
      },
      keyedBlobs
    };
  }

  async getFeed () {
    return await takeAll(this.bTrees.feed.createReadStream());
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
      this.keyedBlobs.close()
    ]);
  }
}
