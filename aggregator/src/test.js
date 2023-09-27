import test from 'ava';
import { join } from 'node:path';
import { Aggregator } from './index.js';
import { withTmpDir, withUpdatedWriter } from '../../peer/src/utils/tests.js';
import { CHAPO, XKCD } from '../../peer/src/const.js';
import { fileExists, withContext } from '../../peer/src/utils/index.js';
import { listDirectories } from './utils.js';
import { wait } from '../../peer/src/utils/async.js';

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
