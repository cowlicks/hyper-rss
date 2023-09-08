import { getUrl, KeyedBlobs } from './blobs.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import test from 'ava';

import { getStore, getStoreAndCores } from './writer.js';

const TMP_DIR_PREFIX = 'hrss-test-';

test('foo', async t => {
  const blobs = [];
  for await (const b of getUrl('https://xkcd.com/rss.xml')) {
    blobs.push(b);
  }
  const buff = Buffer.concat(blobs).toString();
  console.log(buff);
  t.pass();
});

export async function withTmpDir (func, prefix = TMP_DIR_PREFIX) {
  let tmpd;
  try {
    tmpd = await mkdtemp(join(tmpdir(), prefix));
    await func(tmpd);
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    if (tmpd) {
      await rm(tmpd, { recursive: true, force: true });
    }
  }
}

export function assert (a, b) {
  // eslint-disable-next-line eqeqeq
  if (a != b) {
    throw new Error(`assertion failed lhs = [${a}] does not equal rhs = [${b}]`);
  }
}
async function _testkeyblobs (path) {
  const key = 'foobar',
    buff = Buffer.from('Hello, world!');

  const { cores: { blobKeys, blobs } } = getStoreAndCores({ storageName: path });
  const kb = new KeyedBlobs(blobKeys, blobs);
  await kb.init();
  await kb.put(key, buff);
  const gotten = await kb.get(key);
  assert(gotten.toString(), buff);
}
async function _testFromStoreKeyBlobs (tmpd) {
  const key = 'foobar',
    buff = Buffer.from('Hello, world!');
  const { store } = getStore({ storageName: tmpd });
  const kb = KeyedBlobs.fromStore(store);
  await kb.init();
  await kb.put(key, buff);
  const gotten = await kb.get(key);
  assert(gotten.toString(), buff.toString());
}

// (async () => await withTmpDir((tmpd) => _testkeyblobs(tmpd)))();
// (async () => await withTmpDir((tmpd) => _testFromStoreKeyBlobs(tmpd)))();
