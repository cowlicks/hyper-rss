import { fork } from 'node:child_process';

import { STOP_PROCESS } from '../const.js';
import { Deferred } from '../utils/index.js';

// TODO how to handle whenever there is an error in the subprocess? try
// listening IN the cp to 'uncaughtException' and 'close' ON the cp
export async function withProcess ({ modulePath, args = [], options = {} }, func) {
  const child = fork(modulePath, args, { ...options });
  const onClose = Deferred();
  child.on('close', (..._) => {
    onClose.resolve();
  });

  try {
    await func(child);
    child.send(STOP_PROCESS);
  } catch (e) {
    console.error(e);
  }
  await onClose;
}
