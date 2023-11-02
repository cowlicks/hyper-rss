import WebSocket from 'ws';

import express from 'express';
import { RPC_ERROR_CODE_METHOD_NOT_FOUND } from '@hrss/utils/dist/config.js';
import { Target } from '@hrss/utils/dist/target.js';
import { log, LoggableMixin } from '@hrss/utils/dist/logging.js';
import { clone } from '@hrss/utils/dist/index.js';
import { startTiming } from '@hrss/utils/dist/performance.js';

import { urlFromAddress } from '@hrss/peer/src/tools/mirror.js';

export const RpcServer = LoggableMixin(class RpcServer {
  constructor () {
    Object.assign(this, {
      wss: null,
      store: new Store(this),
      onClientClose: new Target(),
      onServerClose: new Target(),
      ranListenToClients: false,
    });
  }

  async close () {
    return await this.onServerClose.dispatch();
  }

  async listenToClients ({ port, app = express(), externalApi } = {}) {
    if (this.ranListenToClients) return;

    if (externalApi) {
      this.store.externalApi = externalApi;
    }

    this.ranListenToClients = true;

    const server = await new Promise(resolve => {
      const out = app.listen(port, () => {
        resolve(out);
      });
    });
    this.onServerClose.addListener(async () => await new Promise(resolve => server.close(resolve)));

    this.wss = new WebSocket.Server({ server });
    this.url = urlFromAddress(server.address());
    this.log(`running on ${this.url}`);

    this.wss.on('headers', (_, request) => this.log(`New Connection:
  sec-websocket-key = [${request.headers['sec-websocket-key']}]
  remoteAddress = [${request?.socket?.remoteAddress}]`));
    this.wss.on('connection', (ws) => {
      this.store.addClient(new ClientConnection(ws, this.store));
    });
    this.wss.on('close', this.onClientClose.dispatch.bind(this.onClientClose));
    return this;
  }
});

export const ClientConnection = LoggableMixin(class ClientConnection {
  constructor (ws, store) {
    Object.assign(
      this,
      {
        ws,
        store,
      });
    this.ws.on('message', (data) => this.onMessage(JSON.parse(data.toString())));
    this.ws.on('close', () => this.end());
    this.ws.on('error', () => this.end());
  }

  end () {
    this.store.removeClient(this);
  }

  send (msg) {
    this.ws.send(JSON.stringify(msg));
  }

  respondOk (id, result) {
    this.send({ id, result });
  }

  respondErr (id, error) {
    this.send({ id, error });
  }

  notify (method, params) {
    this.send({ method, params });
  }

  async onMessage (msg) {
    const funcName = msg.method;

    if (!this.store.externalApi[funcName]) {
      this.respondErr(msg.id, {
        code: RPC_ERROR_CODE_METHOD_NOT_FOUND,
        message: 'Unrecognized method',
        data: { request: clone(msg) },
      });
      return;
    }
    const args = msg?.params;
    try {
      const end = startTiming();
      this.log(`Calling API method: [${funcName}]`);
      const result = await this.store.externalApi[funcName]?.(...args);
      this.log(`API call completed for: [${funcName}]. It took: [${end()} ms]`);
      this.respondOk(msg.id, result);
    } catch (e) {
      this.respondErr(msg.id, {
        error: e?.errno ?? 1,
        message: String(e),
      });
      log.error(`Unexpected error handling client request for Message ${JSON.stringify(msg, null, 2)}.
Got error: ${e}`);
    }
  }
});

export const Store = LoggableMixin(class Store {
  constructor (server = null) {
    Object.assign(
      this,
      {
        server,
        clients: [],
        externalApi: null,
      });
  }

  broadcast (data) {
    this.clients.map((client) => client.notify(data));
  }

  addClient (client) {
    this.clients.push(client);
  }

  removeClient (client) {
    this.clients.splice(
      this.clients.findIndex(({ id }) => id === client.id),
      1,
    );
    this.log(`Removed Client[${client.name}]`);
  }
});

// TODO find better home
const BLOCK_SIZE = 64 * 1024;
const N_BLOCK_CHUNKS = 5;

export class Server extends RpcServer {
  async listenToClients ({ port, app = express(), aggregator } = {}) {
    app.get('/:feed/:blob', async (req, res) => {
      const { feed, blob } = req.params;

      const id = await aggregator.getReaderBlobId(
        feed,
        blob,
        { beeOpts: { wait: false, update: false } },
      );

      const ranges = req.range(id.byteLength);

      // not a range request
      if (!ranges) {
        const result = await aggregator.getReaderBlob(
          req.params.feed,
          req.params.blob,
          { beeOpts: { wait: false, update: false } },
        );
        res.send(result);
        return;
      }

      if (ranges.length !== 1) throw new Error('TODO Got multiple ranges for request??');
      if (ranges.type !== 'bytes') throw new Error('TODO non byte range request ??');
      let { start, end } = ranges[0];
      end = Math.min(id.byteLength, start + BLOCK_SIZE * N_BLOCK_CHUNKS);

      // TODO handle end > byteLength, start > bytelength, start > end
      // res.set(416) // range not satifiable

      const result = await aggregator.getReaderBlobRange(feed, id, { start, end });
      res.set('Content-Range', `bytes ${start}-${end}/${id.byteLength}`);
      res.set('Accept-Ranges', 'bytes');
      res.status(206);

      // this is set automatically
      // res.set('Content-Length', `${start - end + 1}`);

      // TODO do I need to set Content-type ???
      // without it, in the browser, it is showing as application/octet-stream.
      // but should I set it based on the actual content type of the blob?
      // res.set('Content-type', ???);

      res.send(result);
    });

    return super.listenToClients({ port, app, externalApi: aggregator });
  }
}
