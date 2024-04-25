import { withTmpRssFeed } from '../tools/mirror.js';
import { wait } from '../utils/async.js';

const name = process.argv[2];

// locally serve one of our mirrored rss feeds
(async () => {
  await withTmpRssFeed(name, () => wait(1e3 * 60 * 10));
})();
