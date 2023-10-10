import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, rmSync } from 'node:fs';

import { SERVER_URL, PROCESS_SCRIPTS_DIR, STOP_PROCESS, SEND_CLIENT_MESSAGE } from '../const.js';
import { Writer } from '../writer.js';
import { getOnExit } from './index.js';
import { AsyncQueue, Deferred } from '@hrss/utils';
import { withProcess } from './process.js';
import { Reader } from '../reader.js';

const TMP_DIR_PREFIX = 'hrss-test-';

export async function withTmpDir (func, prefix = TMP_DIR_PREFIX) {
  let tmpd;
  let removed = false;
  const p = prefix.call ? prefix(TMP_DIR_PREFIX) : prefix;
  try {
    tmpd = await mkdtemp(join(tmpdir(), p));
    getOnExit().addListener(() => {
      if (!removed && existsSync(tmpd)) {
        rmSync(tmpd, { force: true, recursive: true, maxRetries: 10 });
      }
    });
    await func(tmpd);
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    if (tmpd) {
      await rm(tmpd, { recursive: true, force: true });
      removed = true;
    }
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
    },
    (pref) => `${pref}tmp-writer`,
    );
  });
}

export async function withUpdatedWriter (rssName, testFunc) {
  await withTmpWriter(rssName, async (writer) => {
    await writer.updateFeed();
    await testFunc(writer);
  });
}

export async function withRssSubProcess (name, func) {
  await withProcess({
    modulePath: join(PROCESS_SCRIPTS_DIR, './tmpFeed.js'),
    args: [name],
  },
  async (proc) => {
    const d = Deferred();
    proc.on('message', (msg) => {
      if (msg.kind === SERVER_URL) {
        d.resolve(msg.data);
      }
    });
    const url = await d;
    await func(url);
  });
}

export async function withRpcClient (url, func) {
  await withProcess({
    modulePath: join(PROCESS_SCRIPTS_DIR, './rpcClient.js'),
    args: [url],
  },
  async (proc) => {
    const messages = new AsyncQueue();
    proc.on('message', msg => messages.push(msg));
    const close = () => {
      proc.send({ kind: STOP_PROCESS });
      messages.close();
    };
    const sender = (method, params = []) => proc.send({ kind: SEND_CLIENT_MESSAGE, method, params });
    return await func({ proc, messages, sender, close });
  });
}

export async function withReader (discoveryKey, testFunc) {
  await withTmpDir(async (storageName) => {
    const reader = new Reader(discoveryKey);
    await reader.init({ storageName });
    await reader.bTrees.feed.update({ wait: true });
    try {
      await testFunc(reader);
    } finally {
      await reader.close();
    }
  });
}
