import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const REDDIT = 'reddit',
  XKCD = 'xkcd',
  CHAPO = 'chapo',
  SKEPTOID = 'skeptoid';

export const TEST_URLS = {
  [REDDIT]: 'https://www.reddit.com/.rss',
  [XKCD]: 'https://xkcd.com/rss.xml',
  [CHAPO]: 'https://feeds.soundcloud.com/users/soundcloud%3Ausers%3A211911700/sounds.rss',
  [SKEPTOID]: 'https://feed.skeptoid.com/',
};

const MIRROR_NAMES = new Set([XKCD, CHAPO, SKEPTOID]);
export const MIRROR_URLS = {
  ...(Object.fromEntries([...MIRROR_NAMES]
    .filter(name => MIRROR_NAMES.has(name))
    .map(name => [name, TEST_URLS[name]]))
  ),
};

export const DOWNLOAD_DIR_NAME = 'downloads';
export const MIRRORED_DIR_NAME = 'mirrors';
export const PROCESS_SCRIPTS_DIR_NAME = 'processScripts';

export const CONST_JS_FILENAME = fileURLToPath(import.meta.url);

export const SRC_DIR = dirname(CONST_JS_FILENAME);
export const ROOT_DIR = join(SRC_DIR, '../..');
export const PROCESS_SCRIPTS_DIR = join(SRC_DIR, PROCESS_SCRIPTS_DIR_NAME);

export const MIRRORED_DIR = join(ROOT_DIR, MIRRORED_DIR_NAME);
export const DOWNLOAD_DIR = join(ROOT_DIR, DOWNLOAD_DIR_NAME);

export const STOP_PROCESS = 'stop_process';
export const SEND_CLIENT_MESSAGE = 'send_client_message';
export const CLIENT_RESULT = 'client_result';
export const SERVER_URL = 'server_url';

export const WRITER_PEER_KIND = 'writer';
export const READER_PEER_KIND = 'reader';

export const RSS_METADATA_FIELDS = [
  'title',
  'description',
  'pubDate',
  'lastBuildDate',
];

export const ENCODING = 'base64url';
