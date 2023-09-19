import { KeyedBlobs } from './blobs.js';
import { assert, withTmpDir } from './utils/tests.js';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';

import test from 'ava';

import { getStore, getStoreAndCores, Writer, _testUpdateWriterIntegration } from './writer.js';
import { retry } from './utils/async.js';
import { withRssServer, download, mutateRss, jsonFromXml, xmlFromJson } from './tools/mirror.js';
import { TEST_URLS, CHAPO } from './const.js';

import { _testReaderIntegration } from './reader.js';
import { withRssSubProcess } from './tools/forkedFeed.js';

// does orig str equal dbl parsed?
test('Test parse RSS feed and turn it back into the same XML', async t => {
  await withRssServer('xkcd', async (url) => {
    const downloaded = await download(url);

    const fromParsed = await mutateRss(downloaded, (x) => x);

    const fromRaw = xmlFromJson(await jsonFromXml(downloaded));

    t.is(fromParsed, fromRaw);

    t.pass();
  });
});

test('test new Writer saves config and loading from it does not change it', async t => {
  await withTmpDir(async dir => {
    const configFileName = join(dir, 'config.json');

    // conf does not exist
    t.throwsAsync(stat(configFileName));

    const w = await Writer.forNewUrl(TEST_URLS.xkcd, { configFileName, storageName: dir });
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

test('Smoke test read write',
  async (t) => {
    await withRssSubProcess(CHAPO, async (url) => {
      await _testUpdateWriterIntegration(url, async (x) => {
        await withTmpDir(async (tmpd) => {
          await _testReaderIntegration(tmpd, x);
          t.pass();
        });
      });
    });
  }
);

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
