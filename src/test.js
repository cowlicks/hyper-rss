import { KeyedBlobs } from './blobs.js';
import { Reader } from './reader.js';
import { withTmpDir } from './utils/tests.js';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';

import test from 'ava';

import { getStore, getStoreAndCores, Writer } from './writer.js';
import { retry, takeAll } from './utils/async.js';
import { withRssServer, download, mutateRss, jsonFromXml, xmlFromJson } from './tools/mirror.js';
import { CHAPO, TEST_URLS, XKCD } from './const.js';

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

    const w = await Writer.forNewUrl(TEST_URLS[XKCD], { configFileName, storageName: dir });
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

async function withWriter (url, testFunc) {
  await withTmpDir(async (storageDir) => {
    const writer = new Writer(url, { storageName: storageDir });
    await writer.init();
    await writer.updateFeed();
    await testFunc(writer);
    await writer.close();
  });
}

async function withReader (discoveryKey, testFunc) {
  await withTmpDir(async (storageName) => {
    const reader = new Reader(discoveryKey);
    await reader.init({ storageName });
    await reader.bTrees.feed.update({ wait: true });
    await testFunc(reader);
    await reader.close();
  });
}

test('Smoke test read write XKCD',
  async (t) => {
    await withRssSubProcess(XKCD, async (url) => {
      await withWriter(url, async (writer) => {
        await withReader(writer.discoveryKeyString(), async (reader) => {
          const readItems = await takeAll(reader.bTrees.feed.createReadStream());
          const blobKeys = await writer.keyedBlobs.getKeys();
          t.is(blobKeys.length, 4);
          t.is(readItems.length, 4);
          t.pass();
        });
      });
    });
  }
);

test('Smoke test read write CHAPO',
  async (t) => {
    await withRssSubProcess(CHAPO, async (url) => {
      await withWriter(url, async (writer) => {
        await withReader(writer.discoveryKeyString(), async (reader) => {
          const readItems = await takeAll(reader.bTrees.feed.createReadStream());
          t.is(readItems.length, 5);
          t.is(
            (await writer.keyedBlobs.getKeys()).length,
            5
          );
          t.is(
            (await reader.keyedBlobs.getKeys()).length,
            5
          );
          t.pass();
        });
      });
    });
  }
);

const TEST_KEY = 'foobar',
  TEST_BUFFER = Buffer.from('Mello wort?');

const withKeyeBlobsWithTestData = async (theTest) => {
  await withTmpDir(async (storageName) => {
    const { cores: { blobKeys, blobs }, ...rest } = getStoreAndCores({ storageName });
    const kb = new KeyedBlobs(blobKeys, blobs);
    await kb.init();
    await kb.put(TEST_KEY, TEST_BUFFER);
    await theTest(kb, { storageName, ...rest });
  });
};
test('KeyedBlobs.get', async (t) => {
  await withKeyeBlobsWithTestData(async (kb) => {
    const gotten = await kb.get(TEST_KEY);
    t.deepEqual(gotten, TEST_BUFFER);
  });
});

test('KeyedBlobs.fromStore', async (t) => {
  await withKeyeBlobsWithTestData(async (kb, { storageName, store }) => {
    await kb.close();
    await store.close();
    const { store: store2 } = getStore({ storageName });
    const kb2 = KeyedBlobs.fromStore(store2);
    await kb2.init();
    const gotten = await kb2.get(TEST_KEY);
    t.deepEqual(gotten, TEST_BUFFER);
  });
});
