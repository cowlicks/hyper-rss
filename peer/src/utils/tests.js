import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writer } from '../writer.js';
import { withRssSubProcess } from '../tools/forkedFeed.js';

const TMP_DIR_PREFIX = 'hrss-test-';

export async function withTmpDir (func, prefix = TMP_DIR_PREFIX) {
  let tmpd;
  const p = prefix.call ? prefix(TMP_DIR_PREFIX) : prefix;
  try {
    tmpd = await mkdtemp(join(tmpdir(), p));
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

export async function withTmpWriter (rssName, func) {
  await withRssSubProcess(rssName, async (url) => {
    await withTmpDir(async (storageDir) => {
      const writer = new Writer(url, { storageName: storageDir });
      await writer.init();
      try {
        await func(writer);
      } finally {
        await writer.close();
      }
    });
  });
}

export async function withUpdatedWriter (rssName, testFunc) {
  await withTmpWriter(rssName, async (writer) => {
    await writer.updateFeed();
    await testFunc(writer);
  });
}
