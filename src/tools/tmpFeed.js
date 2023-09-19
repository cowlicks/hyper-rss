import { SERVER_URL, STOP_PROCESS, XKCD } from '../const.js';
import { Deferred } from '../utils/index.js';
import { withTmpRssFeed } from './mirror.js';

(async () => {
  const waitUntil = Deferred();
  const feedName = process.argv[2] ?? XKCD;
  process.on('message', (msg) => {
    if (msg === STOP_PROCESS) {
      waitUntil.resolve();
    }
  });

  await withTmpRssFeed(feedName, async (url) => {
    process.send({ kind: SERVER_URL, data: url });
    await waitUntil;
  });

  process.exit(0);
})();
