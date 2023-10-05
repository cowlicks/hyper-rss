import { Aggregator } from './index.js';
import { cp, readdir } from 'node:fs/promises';
import { withTmpDir } from '@hrss/peer/src/utils/tests.js';

export async function listDirectories (source) {
  const out = (await readdir(source, { withFileTypes: true }))
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  return out;
}

export const withAggregator = async (aggArgs, func) => {
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

export const withAggFromDisk = async (dataDir, func) => {
  await withTmpDir(async tmpd => {
    await cp(dataDir, tmpd, { recursive: true });
    return await withAggregator([{ storageName: tmpd }], async ({ aggregator }) => {
      return await func({ tmpd, aggregator });
    });
  });
};
