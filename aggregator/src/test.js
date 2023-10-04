import test from 'ava';
import { cp } from 'node:fs/promises';
import { join } from 'node:path';
import { Aggregator } from './index.js';
import { withRpcClient, withTmpDir, withUpdatedWriter } from '../../peer/src/utils/tests.js';
import { CHAPO, XKCD } from '../../peer/src/const.js';
import { fileExists } from '../../peer/src/utils/index.js';
import { AGGREGATOR_TEST_DATA } from './const.js';
import { RpcServer } from './back.js';

const withAggregator = async (aggArgs, func) => {
  const aggregator = new Aggregator(...aggArgs);
  await aggregator.init();
  try {
    const out = await func({ aggregator });
    await aggregator.close();
    return out;
  } catch (e) {
    await aggregator.close();
    throw e;
  }
};

test('Aggregator add multiple feeds', async (t) => {
  t.plan(4);
  await withTmpDir(async tmpd => {
    await withAggregator([{ storageName: tmpd }], async ({ aggregator }) => {
      await withUpdatedWriter(CHAPO, async (chapoWriter) => {
        const chapoKey = chapoWriter.discoveryKeyString();
        await aggregator.addReader(chapoKey);
        t.assert(await fileExists(join(tmpd, chapoKey)));
        t.is((await aggregator.getFeedsMetadata()).length, 1);

        await withUpdatedWriter(XKCD, async (xkcdWriter) => {
          const xkcdKey = xkcdWriter.discoveryKeyString();
          await aggregator.addReader(xkcdKey);
          t.assert(await fileExists(join(tmpd, xkcdKey)));
          t.is((await aggregator.getFeedsMetadata()).length, 2);
        });
      });
    });
  });
});

const AGG_DATA_DIR_WITH_TWO_FEEDS = 'agg_init';

const withAggFromDisk = async (dataDir, func) => {
  await withTmpDir(async tmpd => {
    await cp(join(AGGREGATOR_TEST_DATA, dataDir), tmpd, { recursive: true });
    return await withAggregator([{ storageName: tmpd }], async ({ aggregator }) => {
      return await func({ tmpd, aggregator });
    });
  });
};

test('Aggregator init from storage directory', async (t) => {
  t.timeout(1e5);
  t.plan(1);
  await withAggFromDisk(AGG_DATA_DIR_WITH_TWO_FEEDS, async ({ aggregator }) => {
    t.is((await aggregator.getFeedsMetadata()).length, 2);
  });
});

test('Aggregator with RpcServer', async (t) => {
  t.timeout(1e5);
  t.plan(1);
  await withAggFromDisk(AGG_DATA_DIR_WITH_TWO_FEEDS, async ({ aggregator }) => {
    const server = new RpcServer();
    server.store.externalApi = aggregator;
    await server.listenToClients();
    await withRpcClient(server.url, async ({ messages, sender, close }) => {
      const aiter = messages[Symbol.asyncIterator]();

      await sender('getFeedsMetadata', []);
      const clintMsg = (await aiter.next()).value;
      try {
        t.is(clintMsg?.response.result?.length, 2);
      } finally {
        await close();
      }
    });

    await aggregator.close();
  });
});
