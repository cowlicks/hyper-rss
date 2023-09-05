// TODO add a reader that can read our feed from the writer
import { Writer } from './writer.js';

const urls = [
// 'https://www.reddit.com/.rss',
  'https://xkcd.com/rss.xml'
// 'https://feeds.soundcloud.com/users/soundcloud%3Ausers%3A211911700/sounds.rss'
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
