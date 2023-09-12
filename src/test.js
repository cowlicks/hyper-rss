import { KeyedBlobs } from './blobs.js';
import { assert, withTmpDir } from './utils/tests.js';
import { print } from './dev.js';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';

import test from 'ava';

import { getStore, getStoreAndCores, Writer } from './writer.js';
import { retry } from './utils/async.js';
import { withRssServer, download } from './tools/mirror.js';
import { TEST_URLS } from './const.js';
import Parser from 'rss-parser';
import { parseString, Builder } from 'xml2js';

import util from 'node:util';

const testUrl = 'https://xkcd.com/rss.xml';

const jsonFromXml = (xml) => new Promise((resolve, reject) => parseString(xml, (err, result) => err ? reject(err) : resolve(result)));

const xmlFromJson = (json, opts = {}) => (new Builder({ renderOpts: { pretty: false }, ...opts })).buildObject(json);
const rssParse = (xmlStr) => (new Parser()).parseString(xmlStr);

function objectMap (o, func) {
  return Object.fromEntries(func([...Object.entries(o)]));
}

export const renameFields = (obj, renames) => {
  const renameMap = new Map(renames);
  return objectMap(obj, kvArr => {
    return kvArr.map(([k, v]) => (renameMap.has(k) ? [renameMap.get(k), v] : [k, v]));
  });
};

function orderObjArr (ordering, elements) {
  const orderSet = new Set(ordering);
  const elementMap = new Map(elements);
  const out = [];
  for (const o of orderSet) {
    if (elementMap.has(o)) {
      out.push([o, elementMap.get(o)]);
      elementMap.delete(o);
    }
  }
  out.push(...elementMap.entries());
  return out;
}

function orderObj (ordering, o) {
  return objectMap(o, arr => orderObjArr(ordering, arr));
}

export function filterObj (filterFields, o) {
  const filters = new Set(filterFields);
  return objectMap(o, arr => arr.filter(([k, _v]) => !filters.has(k)));
}

const parsedBackToXml = (obj) => {
  let tmp = { ...obj };
  tmp.items = tmp.items
    .map(item => renameFields(item, [['content', 'description']]))
    .map(item => filterObj(['isoDate', 'contentSnippet'], item))
    .map(item => orderObj(['title', 'link', 'description', 'pubDate', 'guid'], item));
  tmp = renameFields(tmp, [['items', 'item']]);
  return {
    rss: {
      $: {
        version: '2.0'
      },
      channel: orderObj(['title', 'link', 'description', 'language', 'channel'], tmp)
    }
  };
};

// does orig str equal dbl parsed?
test('Test parse RSS feed and turn it back into the same XML', async t => {
  await withRssServer('xkcd', async (url) => {
    const downloaded = await download(url);

    const rawJson = await jsonFromXml(downloaded);
    let feedJson = await rssParse(downloaded);

    feedJson = parsedBackToXml(feedJson);

    const fromParsed = xmlFromJson(feedJson);
    const fromRaw = xmlFromJson(rawJson);

    t.is(fromParsed, fromRaw);

    t.pass();
  });
});

test('test new Writer saves config and loading from it does not change it', async t => {
  await withTmpDir(async dir => {
    const configFileName = join(dir, 'config.json');

    // conf does not exist
    t.throwsAsync(stat(configFileName));

    const w = await Writer.forNewUrl(testUrl, { configFileName, storageName: dir });
    await w.init();
    t.teardown(async () => await w.close());

    // conf created
    const o = await stat(configFileName);

    // close writer
    await w.close();

    const w2 = await Writer.fromConfig(configFileName);
    await retry(async () => await w2.init());
    t.teardown(async () => await w2.close());

    const o2 = await stat(configFileName);

    t.is(o.mtimeMs, o2.mtimeMs, 'File not modified by being loaded');
    t.pass();
  });
});

async function _testkeyblobs (path) {
  const key = 'foobar',
    buff = Buffer.from('Hello, world!');

  const { cores: { blobKeys, blobs } } = getStoreAndCores({ storageName: path });
  const kb = new KeyedBlobs(blobKeys, blobs);
  await kb.init();
  await kb.put(key, buff);
  const gotten = await kb.get(key);
  assert(gotten.toString(), buff);
}
async function _testFromStoreKeyBlobs (tmpd) {
  const key = 'foobar',
    buff = Buffer.from('Hello, world!');
  const { store } = getStore({ storageName: tmpd });
  const kb = KeyedBlobs.fromStore(store);
  await kb.init();
  await kb.put(key, buff);
  const gotten = await kb.get(key);
  assert(gotten.toString(), buff.toString());
}

// import { withTmpDir } from './utils/tests.js';
// (async () => await withTmpDir((tmpd) => _testkeyblobs(tmpd)))();
// (async () => await withTmpDir((tmpd) => _testFromStoreKeyBlobs(tmpd)))();
// (async () => await withTmpDir(async (tmpd) => await _testUpdateWriterIntegration(tmpd)))();
/*

(async () => {
  const name = 'foo.json';
  const data = { stuff: 66, yo: 'dog' };
  await writeJsonFile(name, data);
  const result = await readJsonFile(name);
  console.log(result);
})();
*/
