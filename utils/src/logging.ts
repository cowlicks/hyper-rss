/* eslint no-console: 0 */

import config from './config.js';
import { FifoMap } from './cache.js';
import { Target } from './target.js';

export function getGlobal () {
  if (typeof global !== 'undefined') return global;
  return window;
}

class LogBook extends FifoMap {
  print = true;

  count = 0;

  onLog = new Target();

  constructor (maxSize = 1000) {
    super(maxSize);
  }

  dump () {
    return Array.from(this).reverse();
  }

  prettyLog () {
    let out = '';
    for (const [i, entry] of this.dump()) {
      out += `
      ${i}:
        ${entry}`;
    }
    return out;
  }

  log (...entries) {
    if (this.print) {
      console.log(...entries); // eslint-disable-line
    }
    this.set(this.count, entries);
    this.count += 1;
    this.onLog.dispatch(entries);
  }
}

function makeLog () {
  const logBook = new LogBook();
  const log = logBook.log.bind(logBook);

  if (process?.env?.production || process?.env?.NODE_ENV === 'test') {
    logBook.print = false;
  }

  log.onLog = (f) => logBook.onLog.addListener(f);

  return { logBook, log };
}

export const { log, logBook } = makeLog();

export const DEBUG_LOG_LEVEL = 5;
export const INFO_LOG_LEVEL = 4;

export const LOG_LEVELS = {
  INFO: INFO_LOG_LEVEL,
  DEBUG: DEBUG_LOG_LEVEL
};

log.debug = (...args) => {
  if (config.LOG_LEVEL >= DEBUG_LOG_LEVEL) {
    log(...args);
  }
};
log.info = (...args) => {
  if (config.LOG_LEVEL >= INFO_LOG_LEVEL) {
    log(...args);
  }
};
log.error = console.error;
