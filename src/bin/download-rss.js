import { DOWNLOAD_DIR_NAME, MIRRORED_DIR, TEST_URLS } from '../const.js';
import { join } from 'node:path';
import { saveRssToDiskFromUrl } from '../tools/mirror.js';

const name = process.argv[2];
const maxItems = process.argv[3] ?? 5;

const getUrl = (urlOrName) => urlOrName.startsWith('http') ? urlOrName : TEST_URLS[urlOrName];

(async () => {
  const url = getUrl(name);
  console.log(`Creating a local RSS feed from URL = [${url}]`);
  const pathPrefix = join(MIRRORED_DIR, name);
  await saveRssToDiskFromUrl(url, { pathPrefix, maxItems });
})();
