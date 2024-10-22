import { wait } from '@hrss/utils';
import { Server } from '../back.js';
import { AGGREGATOR_TEST_FOO_STORAGE } from '../const.js';
import { Aggregator } from '../index.js';
import { withAggFromDisk } from '../utils.js';

const PORT = 8080;

process.title = 'node:hrss:aggregator';

(async () => {
  await withAggFromDisk(AGGREGATOR_TEST_FOO_STORAGE, async ({ aggregator }) => {
    Aggregator.cacheMethods(aggregator);

    const server = new Server();
    await server.listenToClients({ port: PORT, aggregator });
    try {
      await wait(1e3 * 1e6);
    } catch (e) {
      await server.close();
      throw e;
    } finally {
      await server.close();
    }
  });
})();
