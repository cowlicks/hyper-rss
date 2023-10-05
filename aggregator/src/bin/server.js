import { wait } from '@hrss/utils';
import { RpcServer } from '../back.js';
import { AGG_DATA_DIR_WITH_TWO_FEEDS } from '../const.js';
import { withAggFromDisk } from '../utils.js';

const PORT = 8080;

process.title = 'aggregator';

(async () => {
  await withAggFromDisk(AGG_DATA_DIR_WITH_TWO_FEEDS, async ({ aggregator }) => {
    const server = new RpcServer();
    server.store.externalApi = aggregator;
    await server.listenToClients({ port: PORT });
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
