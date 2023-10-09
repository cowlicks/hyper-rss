import { mirrorNamedRss } from '../tools/mirror.js';

const name = process.argv[2];
const maxItems = process.argv[3] ?? 5;

(async () => {
  await mirrorNamedRss(name, maxItems);
})();
