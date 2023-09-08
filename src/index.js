// Hyperbee only provides a way to download the value of a key all at once
// If we want to be able to stream data from blobs, we would want to store it in something like hyperblobs

// TODO add a reader that can read our feed from the writer
import { _testReaderIntegration } from './reader.js';
import { wait } from './utils/async.js';
import { withTmpDir } from './utils/tests.js';
import { Writer, _testUpdateWriterIntegration } from './writer.js';

/* =
(async () => {
  for (const url of urls) {
    const writer = new Writer(url);
    await writer.init();
    const newItems = await writer.getMissing();
    // find the smallest episode
    const smallest = [...newItems].reduce((acc, obj) => {
      if (acc === null || (obj.rssItem.enclosure.length < acc.rssItem.enclosure.length)) {
        return obj;
      }
      if (!obj.rssItem.enclosure) {
        return acc;
      }
      return acc;
    }, null);
    console.log(smallest);
  }
})();
*/

const writeReadWithTmpDir = async () => {
  await withTmpDir(async (tmpd) => {
    const discoveryKeyString = await _testUpdateWriterIntegration(tmpd);
    await withTmpDir(async (tmpd2) => {
      await _testReaderIntegration(tmpd2, discoveryKeyString);
    });
  });
};
writeReadWithTmpDir();

const justTmpReader = async () => {
  const discoveryKeyString = 'afJWMzrLz9dO0qhx4M6r7XWlXjwCz2MOxHofYANoWIY=';
  const tmpd2 = '/tmp/hrss-test-3uIDLR';
  // console.log('got disc key ', discoveryKeyString ='afJWMzrLz9dO0qhx4M6r7XWlXjwCz2MOxHofYANoWIY=');
  await _testReaderIntegration(tmpd2, discoveryKeyString);
};

/*
const writeReadPersistantTest = async () => {
  const discoveryKeyString = await _testUpdateWriterIntegration(undefined);
  console.log('got disc key ', discoveryKeyString);
  await _testReaderIntegration(undefined, discoveryKeyString);
};

writeReadPersistantTest();
*/
