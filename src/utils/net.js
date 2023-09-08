import https from 'https';
// import { AsyncQueue } from '.';
import { AsyncQueue } from './index.js';

/* Gets bytes from a url as an async iterable. Follows redirects */
export function getUrl (url) {
  const queue = new AsyncQueue();
  https.get(url, res => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      (async () => {
        await queue.addAsyncIter(getUrl(res.headers.location));
        queue.done();
      })();
      return;
    }
    res.on('data', chunk => {
      queue.push(chunk);
    });
    res.on('end', () => {
      queue.done();
    });
  });
  return queue;
}