import https from 'https';
import http from 'http';

import { AsyncQueue } from './index.js';

/* Gets bytes from a url as an async iterable. Follows redirects */
export function getUrl (url, queue = new AsyncQueue()) {
  const htt = url.startsWith('https') ? https : http;
  htt.get(url, res => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      res.destroy();
      return getUrl(res.headers.location, queue);
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
