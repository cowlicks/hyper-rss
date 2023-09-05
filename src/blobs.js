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

export async function getEnclosure (enclosure) {
  console.log('getting enclosure with URL ', enclosure.url);
  console.log(enclosure);
  const stream = getUrl(enclosure.url);
  let i = 0;
  for await (const chunk of stream) {
    console.log(`chun n=[${i}]`, chunk);
    i += 1;
  }
}
