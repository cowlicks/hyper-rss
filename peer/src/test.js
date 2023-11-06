import { join } from 'node:path';
import { stat } from 'node:fs/promises';

import Hypercore from 'hypercore';
import RAM from 'random-access-memory';

import test from 'ava';

import { logBook } from '@hrss/utils';

import { withRssServer, download, mutateRss, jsonFromXml, xmlFromJson } from './tools/mirror.js';
import { withTmpDir, withUpdatedWriter, withTmpWriter, withReader } from './utils/tests.js';
import { retry } from './utils/async.js';

import { KeyedBlobs } from './blobs.js';
import { getStore, getStoreAndCores, Writer } from './writer.js';
import { CHAPO, TEST_URLS, XKCD } from './const.js';
import { Peer } from './peer.js';

import { OrderedHyperbee } from './feed.js';

test('Test peer logging mixin', async (t) => {
  const logString = 'my test log msg';
  const kind = 'FOO KIND';

  const p = new Peer(kind);
  p.log(logString);

  const lastEntry = [...logBook.values()].pop().join('');
  t.assert(lastEntry.match('Peer'));
  t.assert(lastEntry.match(p.name));
  t.assert(lastEntry.match(kind));
  t.assert(lastEntry.match(logString));
});

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

// TODO change this test to make it run locally
test('Test new Writer saves config and loading from it does not change it', async t => {
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

test('Smoke test read write XKCD',
  async (t) => {
    t.timeout(1e3 * 20);
    const nBlobs = 4,
      nFeedItems = 4;
    await withUpdatedWriter(XKCD, async (writer) => {
      t.is((await writer.getFeed()).length, nFeedItems);
      t.is((await writer.keyedBlobs.getKeys()).length, nBlobs);
      await withReader(writer.discoveryKeyString(), async (reader) => {
        t.is((await reader.getFeed()).length, nFeedItems);
        t.is((await reader.keyedBlobs.getKeys()).length, nBlobs);
        t.pass();
      });
    });
  },
);

test('Smoke test read write CHAPO',
  async (t) => {
    t.timeout(1e3 * 20);
    const nBlobs = 5,
      nFeedItems = 5;
    await withUpdatedWriter(CHAPO, async (writer) => {
      t.is((await writer.getFeed()).length, nFeedItems);
      t.is((await writer.keyedBlobs.getKeys()).length, nBlobs);
      await withReader(writer.discoveryKeyString(), async (reader) => {
        t.is((await reader.getFeed()).length, nFeedItems);
        t.is((await reader.keyedBlobs.getKeys()).length, nBlobs);
        t.pass();
      });
    });
  },
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

test('Writer get feed title',
  async (t) => {
    t.timeout(1e3 * 100);
    await withTmpWriter(CHAPO, async (writer) => {
      const title = 'Chapo Trap House';
      const description = 'Podcast by Chapo Trap House';

      await writer.updateMetadata();
      t.is(await writer.feed.getMetadataValue('title'), title);
      t.is(await writer.feed.getMetadataValue('description'), description);
      t.pass();
    });
  },
);
test('OrderedHyperbee is ordered', async (t) => {
  const core = new Hypercore(RAM);
  const oh = new OrderedHyperbee(core);
  await oh.ready();
  await oh.putOrderdItem('100', 'hundred');
  await oh.putOrderdItem('001', 'one');
  await oh.putOrderdItem('010', 'ten');
  const stream = oh.getFeedStream()[Symbol.asyncIterator]();
  let result;

  result = (await stream.next()).value;
  t.deepEqual(
    [result.orderIndex, result.key.toString(), result.value.toString()],
    [2, '010', 'ten'],
  );
  result = (await stream.next()).value;
  t.deepEqual(
    [result.orderIndex, result.key.toString(), result.value.toString()],
    [1, '001', 'one'],
  );
  result = (await stream.next()).value;
  t.deepEqual(
    [result.orderIndex, result.key.toString(), result.value.toString()],
    [0, '100', 'hundred'],
  );
  t.pass();
});
