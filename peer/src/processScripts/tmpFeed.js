import { SERVER_URL, STOP_PROCESS, XKCD } from '../const.js';
import { Deferred } from '@hrss/utils';
import { withTmpRssFeed } from '../tools/mirror.js';

(async () => {
  const waitUntil = Deferred();
  const feedName = process.argv[2] ?? XKCD;
  process.title = `tmpfeed:${feedName}`;
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
