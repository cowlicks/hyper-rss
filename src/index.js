// Hyperbee only provides a way to download the value of a key all at once
// If we want to be able to stream data from blobs, we would want to store it in something like hyperblobs

// TODO add a reader that can read our feed from the writer
import { _testReaderIntegration } from './reader.js';
import { withTmpDir } from './test.js';
import { Writer, _testUpdateWriterIntegration } from './writer.js';

const urls = [
// 'https://www.reddit.com/.rss',
  // 'https://xkcd.com/rss.xml',
  // 'https://feeds.soundcloud.com/users/soundcloud%3Ausers%3A211911700/sounds.rss',
  'https://feed.skeptoid.com/'
];

/* =
(async () => {
  for (const url of urls) {
    const writer = new Writer(url);
    await writer.init();
    const newItems = await writer.getMissing();
    // find the smallest episode
    const smallest = [...newItems].reduce((acc, obj) => {
      if (acc === null || (obj.rssItem.enclosure.length < acc.rssItem.enclosure.length)) {
        return obj;
      }
      if (!obj.rssItem.enclosure) {
        return acc;
      }
      return acc;
    }, null);
    console.log(smallest);
  }
})();
*/

(async () => {
  await withTmpDir(async (tmpd) => {
    const discoveryKeyString = await _testUpdateWriterIntegration(tmpd);
    console.log('got disc key ', discoveryKeyString);
    await withTmpDir(async (tmpd2) => {
      await _testReaderIntegration(tmpd2, discoveryKeyString);
    });
  });
})();
