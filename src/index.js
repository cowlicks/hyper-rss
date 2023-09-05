// Hyperbee only provides a way to download the value of a key all at once
// If we want to be able to stream data from blobs, we would want to store it in something like hyperblobs

// TODO add a reader that can read our feed from the writer
import { Writer } from './writer.js';

const urls = [
// 'https://www.reddit.com/.rss',
  // 'https://xkcd.com/rss.xml'
  'https://feeds.soundcloud.com/users/soundcloud%3Ausers%3A211911700/sounds.rss'
  // 'https://feed.skeptoid.com/'
];

(async () => {
  for (const url of urls) {
    const writer = new Writer(url);
    await writer.init();
    const added = await writer.updateFeed();
    console.log(`Added [${added.length}] items`);
    console.log('To core with key', writer.discoveryKeyString());
  }
})();
