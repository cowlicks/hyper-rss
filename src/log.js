import { FifoMap } from './cache.js';

export class LogBook extends FifoMap {
  constructor () {
    super(...arguments);
    this.print = true;
    this.count = 0;
  }

  dump () {
    return Array.from(this).reverse();
  }

  prettyLog () {
    let out = '!!! This log may contain information about your browisng !!!';
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
  }
}

const TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4;

const LOG_LEVELS = {
  TRACE,
  DEBUG,
  INFO,
  WARN,
  ERROR
};

const DEFAULT_LOG_LEVEL = 2;

function runOnce (func) {
  let ran = false;
  let result;

  return (...args) => {
    if (ran === false) {
      result = func(...args);
      ran = true;
    }
    return result;
  };
}

export const getLogLevel = runOnce(() => {
  const logLevel = (process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL.toString()).trim();

  // '' or ' ' etc.
  if (logLevel === '') return DEFAULT_LOG_LEVEL;

  // warn, WARN, etc.
  if ((new Set(Object.keys(LOG_LEVELS))).has(logLevel.toUpperCase())) {
    return LOG_LEVELS[logLevel.toUpperCase()];
  }
  // number
  const parsedLogLevel = parseInt(logLevel, 10);
  if (!Number.isNaN(parsedLogLevel)) {
    return parsedLogLevel;
  }

  // something wrong
  return DEFAULT_LOG_LEVEL;
});

export const getLogger = runOnce(() => new LogBook());

function makeLogger (level) {
  return (...args) => {
    if (LOG_LEVELS[level] < getLogLevel()) {
      return;
    }
    getLogger().log(level, ...args);
  };
}

export const log = {
  trace: makeLogger('TRACE'),
  debug: makeLogger('DEBUG'),
  info: makeLogger('INFO'),
  warn: makeLogger('WARN'),
  error: makeLogger('ERROR')
};
