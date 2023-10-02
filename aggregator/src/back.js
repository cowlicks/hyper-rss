import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

import config, { RPC_ERROR_CODE_METHOD_NOT_FOUND } from '@hrss/utils/dist/config.js';
import { Target } from '@hrss/utils/dist/target.js';
import { log } from '@hrss/utils/dist/logging.js';
import { clone } from '@hrss/utils/dist/index.js';
import { startTiming } from '@hrss/utils/dist/performance.js';

export class RpcServer {
  constructor ({ port = 8080 } = {}) {
    Object.assign(this, {
      port,
      wss: null,
      store: new Store(this),
      onClose: new Target(),
      ranListenToClients: false
    });
  }

  listenToClients (port = this.port ?? config.DAEMON_PORT) {
    if (this.ranListenToClients) return;

    this.ranListenToClients = true;

    this.port = port;
    this.wss = new WebSocket.Server({ port });
    this.wss.on('headers', (_, request) => console.log(`New Connection:
  sec-websocket-key = [${request.headers['sec-websocket-key']}]
  remoteAddress = [${request?.socket?.remoteAddress}]`));
    this.wss.on('connection', (ws) => {
      this.store.addClient(new ClientConnection(ws, this.store));
    });
    this.wss.on('close', this.onClose.dispatch.bind(this.onClose));
  }
}

export class ClientConnection {
  constructor (ws, store, id = uuidv4()) {
    Object.assign(
      this,
      {
        ws,
        store,
        id
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
        data: { request: clone(msg) }
      });
      return;
    }
    const args = msg?.params;
    try {
      const end = startTiming();
      log(`Calling API method: [${funcName}]`);
      const result = await this.store.externalApi[funcName]?.(...args);
      log(`API call completed for: [${funcName}]. It took: [${end()} ms]`);
      this.respondOk(msg.id, result);
    } catch (e) {
      this.respondErr(msg.id, {
        error: e?.errno ?? 1,
        message: String(e)
      });
      log.error(`Unexpected error handling client request for Message ${JSON.stringify(msg, null, 2)}.
Got error: ${e}`);
    }
  }
}

export class Store {
  constructor (server = null, {
    id = uuidv4()
  } = {}) {
    Object.assign(
      this,
      {
        id,
        server,
        clients: [],
        externalApi: {}
      });
  }

  log (s) {
    log(`Store.id: [${this.id}] ${s}`);
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
      1
    );
    this.log(`Removed Client.id [${client.id}]`);
  }
}
