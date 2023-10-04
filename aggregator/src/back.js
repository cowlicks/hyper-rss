import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

import express from 'express';
import { RPC_ERROR_CODE_METHOD_NOT_FOUND } from '@hrss/utils/dist/config.js';
import { Target } from '@hrss/utils/dist/target.js';
import { log } from '@hrss/utils/dist/logging.js';
import { clone } from '@hrss/utils/dist/index.js';
import { startTiming } from '@hrss/utils/dist/performance.js';

import { urlFromAddress } from '@hrss/peer/src/tools/mirror.js';
import { randName } from '@hrss/peer/src/utils/index.js';

export class RpcServer {
  constructor () {
    Object.assign(this, {
      wss: null,
      store: new Store(this),
      onClientClose: new Target(),
      onServerClose: new Target(),
      ranListenToClients: false,
      name: randName(),
    });
  }

  async close () {
    return await this.onServerClose.dispatch();
  }

  async listenToClients ({ port } = {}) {
    if (this.ranListenToClients) return;

    this.ranListenToClients = true;

    const app = express();
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

  log (...x) {
    console.log(`RpcServer[${this.name}]`, ...x);
  }
}

export class ClientConnection {
  constructor (ws, store, id = uuidv4()) {
    Object.assign(
      this,
      {
        ws,
        store,
        id,
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

  log (...s) {
    console.log(`Client[${this.id}]`, ...s);
  }
}

export class Store {
  constructor (server = null, {
    id = uuidv4(),
  } = {}) {
    Object.assign(
      this,
      {
        id,
        server,
        clients: [],
        externalApi: {},
      });
  }

  log (...s) {
    console.log(`Store[${this.id}]`, ...s);
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
    this.log(`Removed Client.id [${client.id}]`);
  }
}