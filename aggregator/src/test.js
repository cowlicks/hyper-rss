import test from 'ava';
import { cp } from 'node:fs/promises';
import { join } from 'node:path';
import { Aggregator } from './index.js';
import { withTmpDir, withUpdatedWriter } from '../../peer/src/utils/tests.js';
import { CHAPO, XKCD } from '../../peer/src/const.js';
import { fileExists, withContext } from '../../peer/src/utils/index.js';
import { AGGREGATOR_TEST_DATA } from './const.js';
import { RpcServer } from './back.js';
import { wait } from '@hrss/utils';

const withAggregator = async (func) => {
  const obj = {};
  obj.enter = async () => {
    return await withTmpDir(async (tmpd) => {
      const aggregator = new Aggregator({ storageName: tmpd });
      await aggregator.init();
      obj.exit = () => aggregator.close();
      obj.func = async () => {
        await func({ aggregator, tmpd });
      };
    });
  };
  return withContext(obj);
};

test('Aggregator', async (t) => {
  await withAggregator(async ({ aggregator, tmpd }) => {
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
  t.pass();
});

test('Aggregator init from storage directory', async (t) => {
  t.timeout(1e5);
  const testDataDir = 'agg_init';
  await withTmpDir(async (tmpd) => {
    await cp(join(AGGREGATOR_TEST_DATA, testDataDir), tmpd, { recursive: true });
    const aggregator = new Aggregator({ storageName: tmpd });
    await aggregator.init();
    t.is((await aggregator.getFeedsMetadata()).length, 2);
    await aggregator.close();
  });
  t.pass();
});
