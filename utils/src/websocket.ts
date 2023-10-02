import WebSocket from 'isomorphic-ws';

import config from './config.js';

import { Target } from './target.js';
import { log } from './logging.js';
import { Deferred, IDeferred } from './async.js';

type ReadyState = 0 | 1 | 2 | 3;
interface ReadyStateGetter {
  (): ReadyState;
}

interface WebSocketState {
  _alreadyInitialized?: boolean;
}

class OnReadyStateChange extends Target {
  state: ReadyState;

  readyStateGetter: ReadyStateGetter;

  constructor (readyStateGetter: ReadyStateGetter) {
    super();
    this.state = null;
    this.readyStateGetter = readyStateGetter;
  }

  attach (...targets: Target[]) {
    const listener = this.maybeChange.bind(this);
    for (const t of targets) {
      t.addListener(listener);
    }
  }

  maybeChange () {
    const state = this.readyStateGetter();
    if (this.state !== state) {
      this.dispatch(this.state = state);
    }
  }
}

function isConnected (ws: WebSocket) {
  if (ws) return ws.readyState === 1;
  return false;
}

interface WsOptions {
  url?: string;
  ws?: WebSocket;
  reconnectInterval?: number;
  reconnectAttempts?: number;
}

export const optionsToWebsocket = (options: WsOptions) => {
  if (options.ws && isConnected(options.ws)) {
    return options.ws;
  } if (options.url) {
    console.log(`Creating a new websocket and connecting to [${options.url}]`);
    return new WebSocket(options.url);
  }
  throw new Error('No websocket or url provided to connect');
};

export class BaseWsConnection {
  _ws: WebSocket & WebSocketState = null;

  options: WsOptions;

  onOpen: Target;

  onClose: Target;

  onMessage: Target;

  onError: Target;

  constructor (options: WsOptions = {}) {
    this.options = options;
    this.onOpen = new Target();
    this.onClose = new Target();
    this.onMessage = new Target({
      beforeDispatch: ({ data }, cancel) => { // eslint-disable-line consistent-return
        try {
          return JSON.parse(data);
        } catch (e) {
          cancel();
          log(`Error parsing message from instrument.
  Message:
    ${data}
  Error:
    ${e}
  `);
        }
      }
    });
    this.onError = new Target();
  }

  get readyState (): ReadyState {
    return this._ws?.readyState as ReadyState ?? 3;
  }

  get url () {
    return this._ws?.url ?? this.options?.ws?.url ?? this.options?.url;
  }

  changeUrl (url: string) {
    return this._reallyConnect({ url });
  }

  send (msg) {
    this.connect();
    this._ws.send(JSON.stringify(msg));
  }

  isConnected (ws = this._ws) {
    return isConnected(ws);
  }

  connect (options = {}) {
    if (this.isConnected() || this.readyState === 0) return Promise.resolve();
    return this._reallyConnect(options);
  }

  // TODO add timeout
  _reallyConnect (options) {
    this.close();
    let resolveHolder, rejectHolder;
    const out = new Promise((resolve, reject) => {
      resolveHolder = resolve;
      rejectHolder = reject;
      this.onOpen.addListener(resolveHolder);
      this.onError.addListener(rejectHolder);
    }).finally(() => {
      this.onOpen.removeListener(resolveHolder);
      this.onError.removeListener(rejectHolder);
    });
    this.options = { ...this.options, ...options };

    this._ws = optionsToWebsocket(this.options);
    if (isConnected(this._ws)) {
      resolveHolder();
    }

    this.options.url = this._ws.url;
    this.initializeWebsocket(this._ws);
    return out;
  }

  close () {
    this?._ws?.close();
    delete this._ws;
  }

  initializeWebsocket (ws: WebSocket & WebSocketState) {
    if (ws._alreadyInitialized) return;
    ws._alreadyInitialized = true;

    ws.addEventListener('open', (newWs) => this.onOpen.dispatch(newWs));
    ws.addEventListener('message', (e) => this.onMessage.dispatch(e));
    ws.addEventListener('error', (e) => this.onError.dispatch(e));
    ws.addEventListener('close', (e) => this.onClose.dispatch(e));
  }
}

// Adds features to BaseWsConnection:
// * tries to reconnect on disconnect
// * eventListener for readyState changes
// * waits for connection before attempting a send
// * if not connected on send, tries to connect
// * waits for connection before trying to send
export class WsConnection extends BaseWsConnection {
  firstIsReady = Deferred();

  _isReady: IDeferred<unknown>;

  onReadyStateChange: OnReadyStateChange;

  shutDownCalled = false;

  reconnectTimeId = null;

  static fromUrl (url: string) {
    return new this({ url });
  }

  constructor (options: WsOptions = {}) {
    super(options);

    const readyStateGetter = () => this.readyState;
    this.onReadyStateChange = new OnReadyStateChange(readyStateGetter);
    this.onReadyStateChange.attach(this.onOpen, this.onClose, this.onError);

    this.onClose.addListener(() => {
      clearTimeout(this.reconnectTimeId);
      if (this.shutDownCalled) return;

      this.reconnectTimeId = setTimeout(() => {
        if (this.isConnected()) return;

        this.connect().catch((e) => log(`Failed to reconnect to websocket. Got error ${e?.message || e?.code}`));
      }, config.WS_RECONNECT_INTERVAL);
    });

    this.isReady = this.firstIsReady;
    this.onReadyStateChange.addListener((state: ReadyState) => {
      switch (state) {
        case 0:
          if (!(this.isReady === this.firstIsReady)) this.isReady = Deferred();
          break;
        case 1:
          this.isReady.resolve();
          break;
        default:
          this.isReady.rejectAndCatch(('Connection closing or closed'));
      }
    });
  }

  shutDown () {
    this.shutDownCalled = true;
    this.close();
  }

  get isReady () {
    if (this?._ws?.readyState === 1) this._isReady.resolve();
    return this._isReady;
  }

  set isReady (x) {
    this._isReady = x;
  }

  async send (msg: unknown) {
    await this.connect();
    await this.isReady;
    return super.send(msg);
  }

  enablePingPong (keepAliveTime = config.KEEPALIVE_MS) {
    let isAlive = true;
    let start = Date.now();
    let tid;
    let sincePingSent;

    const ss = (x) => (Date.now() - x) / 1000;
    const ppLog = (x) => log(`ping-pong id[${tid}]: ${x}`);

    const onPing = () => {
      isAlive = true;
    };

    const onPong = () => {
      isAlive = true;
    };

    const heartBeat = () => {
      if (!isAlive && ((Date.now() - sincePingSent) > keepAliveTime)) {
        ppLog(`${ss(sincePingSent)} seconds since ping sent with no pong response.
  terminating connection due to keepalive!
          `);
        this?._ws?.terminate();
        return;
      }
      isAlive = false;
      sincePingSent = Date.now();
      try {
        this._ws.ping('ping');
      } catch (e) {
        // Error is thrown by WS.ping when the websocket is closed - so close in this case
        ppLog(`Terminating connection because Websocke.ping threw error: ${e}`);
        this?._ws?.terminate();
      }
    };

    const startPingPong = () => {
      isAlive = true;
      start = Date.now();

      this._ws.addListener('ping', onPing);
      this._ws.addListener('pong', onPong);

      tid = setInterval(heartBeat, keepAliveTime);
      ppLog(`START
 at url: ${this?._ws?.url}
 at time: ${new Date()}
 with keepalive: ${keepAliveTime}ms`);
    };

    const stopPingPong = () => {
      ppLog(`STOP
 at url: ${this?._ws?.url}
 at time: ${new Date()}
 at time: ${new Date()}
 since start: ${ss(start)} seconds`);
      this?._ws?.removeListener('ping', onPing);
      this?._ws?.removeListener('pong', onPong);
      clearInterval(tid);
    };

    if (this.readyState === 1) startPingPong();

    this.onOpen.addListener(startPingPong);
    this.onClose.addListener(stopPingPong);
  }
}
