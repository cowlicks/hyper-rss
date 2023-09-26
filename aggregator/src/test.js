import test from 'ava';
import { join } from 'node:path';
import { Aggregator } from './index.js';
import { withTmpDir, withUpdatedWriter } from '../../peer/src/utils/tests.js';
import { CHAPO, XKCD } from '../../peer/src/const.js';
import { fileExists, withContext } from '../../peer/src/utils/index.js';

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
test('Construct Aggregator', async (t) => {
  await withAggregator(async ({ aggregator, tmpd }) => {
    await withUpdatedWriter(CHAPO, async (chapoWriter) => {
      const chapoKey = chapoWriter.discoveryKeyString();
      await aggregator.addReader(chapoKey);
      t.assert(await fileExists(join(tmpd, chapoKey)));
      // TODO test this
      // const feed = await aggregator.getReaderFeed(chapoKey);
      // TODO test this
      const metas = await aggregator.getFeedsMetadata();

      // TODO test multi feeds
      await withUpdatedWriter(XKCD, async (xkcdWriter) => {
      });
    });
  });
  t.pass();
});
