import { KeyedBlobs } from './blobs.js';
import { getUrl } from './utils/index.js';
import { assert, withTmpDir } from './utils/tests.js';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';

import test from 'ava';

import { getStore, getStoreAndCores, Writer } from './writer.js';
import { retry, wait } from './utils/async.js';

const testUrl = 'https://xkcd.com/rss.xml';

test('test new Writer saves config and loading from it does not change it', async t => {
  await withTmpDir(async dir => {
    const configFileName = join(dir, 'config.json');

    // conf does not exist
    t.throwsAsync(stat(configFileName));

    const w = await Writer.forNewUrl(testUrl, { configFileName, storageName: dir });
    await w.init();
    t.teardown(async () => await w.close());

    // conf created
    const o = await stat(configFileName);

    // close writer
    await w.close();

    const w2 = await Writer.fromConfig(configFileName);
    await retry(async () => await w2.init());
    t.teardown(async () => await w2.close());

    const o2 = await stat(configFileName);

    t.is(o.mtimeMs, o2.mtimeMs, 'File not modified by being loaded');
    t.pass();
  });
});

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

// import { withTmpDir } from './utils/tests.js';
// (async () => await withTmpDir((tmpd) => _testkeyblobs(tmpd)))();
// (async () => await withTmpDir((tmpd) => _testFromStoreKeyBlobs(tmpd)))();
// (async () => await withTmpDir(async (tmpd) => await _testUpdateWriterIntegration(tmpd)))();
/*

(async () => {
  const name = 'foo.json';
  const data = { stuff: 66, yo: 'dog' };
  await writeJsonFile(name, data);
  const result = await readJsonFile(name);
  console.log(result);
})();
*/
