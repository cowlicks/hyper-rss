import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP_DIR_PREFIX = 'hrss-test-';

export async function withTmpDir (func, prefix = TMP_DIR_PREFIX) {
  let tmpd;
  try {
    tmpd = await mkdtemp(join(tmpdir(), prefix));
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
