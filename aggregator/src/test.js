import test from 'ava';
import { join } from 'node:path';
import { ApiCache, DEFAULT_CACHE_HASH } from './cache.js';
import { withRpcClient, withTmpDir, withUpdatedWriter } from '../../peer/src/utils/tests.js';
import { CHAPO, XKCD } from '../../peer/src/const.js';
import { fileExists } from '../../peer/src/utils/index.js';
import { AGGREGATOR_TEST_FOO_STORAGE } from './const.js';
import { RpcServer } from './back.js';
import { withAggregator, withAggFromDisk } from './utils.js';
import { LruMap, stableStringify } from '@hrss/utils';

test('Aggregator add multiple feeds', async (t) => {
  t.plan(4);
  await withTmpDir(async tmpd => {
    await withAggregator([{ storageName: tmpd }], async ({ aggregator }) => {
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
  });
});

test('Aggregator init from storage directory', async (t) => {
  t.timeout(1e5);
  t.plan(1);
  await withAggFromDisk(AGGREGATOR_TEST_FOO_STORAGE, async ({ aggregator }) => {
    t.is((await aggregator.getFeedsMetadata()).length, 2);
  });
});

test('Aggregator with RpcServer', async (t) => {
  t.timeout(1e5);
  t.plan(1);
  await withAggFromDisk(AGGREGATOR_TEST_FOO_STORAGE, async ({ aggregator }) => {
    const server = new RpcServer();
    server.store.externalApi = aggregator;
    await server.listenToClients();
    await withRpcClient(server.url, async ({ messages, sender, close }) => {
      const aiter = messages[Symbol.asyncIterator]();

      await sender('getFeedsMetadata', []);
      const clintMsg = (await aiter.next()).value;
      try {
        t.is(clintMsg?.response.result?.length, 2);
      } finally {
        await close();
      }
    });

    await aggregator.close();
  });
});

export function isPrimitive (test) {
  return test !== Object(test);
}

test('isPrimitive', (t) => {
  t.assert(isPrimitive(6));
  t.assert(isPrimitive(true));
  t.assert(isPrimitive(false));
  t.assert(isPrimitive(null));
  t.assert(isPrimitive(undefined));
  t.assert(isPrimitive(Symbol('snths')));
  t.assert(isPrimitive('sth'));

  t.false(isPrimitive(new Map()));
  t.false(isPrimitive([]));
  t.false(isPrimitive({}));
});

function wrapObject (obj, { onGet, path }) {
  return new Proxy(obj, {
    get (_target, prop, _receiver) {
      const node = Reflect.get(...arguments);
      const p = path || [];
      p.push(prop);

      // if target[prop] is primative, or array, return it
      if (isPrimitive(node) || Array.isArray(node)) {
        onGet(p);
        return node;
      } else {
        return wrapObject(node, { onGet, path: p });
      }
    },
    // TODO
    // apply (target, thisArg, argumentsList) {
    //  console.log('from apply', ...arguments);
    //  return Reflect.apply(target, thisArg, argumentsList);
    // },
    // TODO
    // set(obj, prop, value)
  });
}

test('wrapped', async (t) => {
  let result;
  const wrapped = wrapObject({ a: 6 }, { onGet: (x) => (result = x) });
  const got = wrapped.a;

  t.is(got, 6);
  t.deepEqual(result, ['a']);

  const wrapped2 = wrapObject({ b: { c: 3, d: [] }, e: 5 }, { onGet: (x) => (result = x) });
  t.is(wrapped2.b.c, 3);
  t.deepEqual(result, ['b', 'c']);

  t.deepEqual(wrapped2.b.d, []);
  console.log(result);
  t.deepEqual(result, ['b', 'd']);
});
test('LruMap', async (t) => {
  const m = new LruMap({ maxSize: 2 });
  m.set(1, 2);
  m.set(3, 4);
  t.deepEqual([[1, 2], [3, 4]], [...m]);
  m.get(1);
  t.deepEqual([[3, 4], [1, 2]], [...m]);
  m.set(5, 6);
  t.deepEqual([[1, 2], [5, 6]], [...m]);
});

test('stableStringify', (t) => {
  t.deepEqual(stableStringify(1), '1');
  t.deepEqual(stableStringify(null), 'null');
  t.deepEqual(stableStringify(undefined), undefined);
  t.deepEqual(stableStringify('foo'), '"foo"');
  t.deepEqual(stableStringify({}), '{}');
  t.deepEqual(stableStringify({ b: 1, a: 6 }), '{"a":6,"b":1}');
  t.deepEqual(stableStringify({ a: 6, b: 1 }), '{"a":6,"b":1}');
  t.deepEqual(stableStringify({ b: { c: 1, d: 2 }, a: { f: 3, e: 4 } }), '{"a":{"e":4,"f":3},"b":{"c":1,"d":2}}');
  t.deepEqual(stableStringify([]), '[]');
});

test('ApiCache', async (t) => {
  const f1 = (x) => {
    return x + 2;
  };

  const funcs = new Map([[
    'f1',
    [(...x) => stableStringify(x), f1],
  ]]);
  const apiCache = new ApiCache({ funcs });
  t.false(apiCache.getCached(['f1', [6]]).cached);

  const result = await apiCache.aget(['f1', [6]]);
  t.is(result, 8);

  const { cached, value } = apiCache.getCached(['f1', [6]]);
  t.true(cached);
  t.is(value, 8);

  const removed = apiCache.invalidate(/f1/);

  t.is(removed.length, 1);
  t.false(apiCache.getCached(['f1', [6]]).cached);

  const f2 = (x) => x + 'bar';

  t.assert(apiCache.funcs.has('f1'));
  t.false(apiCache.funcs.has('f2'));

  apiCache.funcs.set(f2.name, [DEFAULT_CACHE_HASH, f2]);

  const r2 = await apiCache.aget([f2.name, ['foo']]);
  t.is(r2, 'foobar');
  t.is(await apiCache.aget([f2.name, ['foo']]), 'foobar');
});
