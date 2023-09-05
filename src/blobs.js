import { AsyncQueue } from './utils.js';

import https from 'https';

/* Gets bytes from a url as an async iterable. Follows redirects */
function getUrl (url) {
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

// TODO rewrite url in the enclosure to anonymize it
export async function getEnclosure (enclosure) {
  const chunks = [];
  for await (const chunk of getUrl(enclosure.url)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function transformItem (item) {
}
