import { Deferred, AsyncQueue } from '@hrss/utils/dist/async.js';
import { WebClient } from '@hrss/utils/dist/messages.js';
import { CLIENT_RESULT, SEND_CLIENT_MESSAGE, STOP_PROCESS } from '../const.js';

(async () => {
  const url = process.argv[2];

  const messages = new AsyncQueue();

  if (!url) {
    throw new Error('URL argument not provided');
  }

  process.on('message', (msg) => messages.push(msg));

  const client = WebClient.fromUrl(url);

  const close = async () => Promise.all([messages.close(), client.close()]);
  for await (const m of messages) {
    if (m.kind === STOP_PROCESS) {
      await close();
    } else if (m.kind === SEND_CLIENT_MESSAGE) {
      const response = await client.request(m.method, m.params ?? []);
      process.send({ kind: CLIENT_RESULT, response });
    }
  }
  process.exit(0);
})();
