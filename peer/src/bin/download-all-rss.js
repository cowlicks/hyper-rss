import { MIRROR_URLS } from '../const.js';
import { mirrorNamedRss } from '../tools/mirror.js';

(async () => {
  await Promise.all(Object.keys(MIRROR_URLS).map(name => mirrorNamedRss(name)));
})();
