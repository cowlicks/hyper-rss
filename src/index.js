import Hypercore from 'hypercore';
import Parser from 'rss-parser';
import { Items, itemsNotHyperized } from './items.js';
let parser = new Parser();

const urls = [
//'https://www.reddit.com/.rss',
'https://xkcd.com/rss.xml',
//'https://feeds.soundcloud.com/users/soundcloud%3Ausers%3A211911700/sounds.rss'
];

(async () => {

  const core = new Hypercore('./writer-storage');
  await core.ready();
  const items = new Items({core});

  for (const url of urls) {
    let feed = await parser.parseURL(url);
    const missing = await itemsNotHyperized(feed.items, items.db);
    const batcher = items.db.batch();
    for (const {key, rssItem} of missing) {
      console.log(key, rssItem)
      await batcher.put(key, JSON.stringify(rssItem));
    }
    await batcher.flush();
  }

})();
