import { MIRROR_URLS } from '../const.js';
import { mirrorNamedRss } from '../tools/mirror.js';

// Create local mirrors of all of our test urls
// this includes dowloading images and enclusers within the feeds
// and rewriting the urls in the feed to point to these files on disk
// TODO have this merge with the current feeds on disk
(async () => {
  await Promise.all(Object.keys(MIRROR_URLS).map(name => mirrorNamedRss(name)));
})();
