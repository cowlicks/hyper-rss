import { performance } from 'perf_hooks';

export function startTiming () {
  const start = performance.now();
  return () => performance.now() - start;
}

export function timeFunc (func, cb = console.log.bind(console)) { // eslint-disable-line no-console
  return (...args) => {
    const end = startTiming();
    const out = func(...args);
    Promise.resolve(out).catch(() => {}).finally(() => cb(end()));
    return out;
  };
}
