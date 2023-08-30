import Hypercore from 'hypercore';
import Parser from 'rss-parser';
import { Items } from './src/items.js';
let parser = new Parser();

const urls = ['https://www.reddit.com/.rss', 'https://xkcd.com/rss.xml', 'https://feeds.soundcloud.com/users/soundcloud%3Ausers%3A211911700/sounds.rss'];

(async () => {

  const core = new Hypercore('./writer-storage')
  await core.ready()
  console.log('hypercore key:', core.key);
  for (const url of urls) {
  let feed = await parser.parseURL(url);
  console.log(feed.title);
  feed.items.forEach(item => {
    console.log(item);
    console.log(item.title + ':' + item.link)
  });
  }

  //console.log(feed)


  //feed.items.forEach(item => {
  //  console.log(item);
  //  console.log(item.title + ':' + item.link)
  //});

})();
