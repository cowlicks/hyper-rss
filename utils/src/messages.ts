import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

import { Deferred } from './async.js';
import { Target } from './target.js';
import { WsConnection } from './websocket.js';
import { log } from './logging.js';
import { isNullish } from './index.js';

export interface Request {
    id: string;
    timestamp: string;
    method: string;
    params?: ArrayLike<unknown>;
}

export interface Notification {
    timestamp: string;
    method: string;
    params?: ArrayLike<unknown>;
}

export type RpcCall = Request | Notification;

function isRequest(m: RpcCall): m is Request {
  return (m as Request).id !== undefined
}

type ValueOf<T> = T[keyof T];

export interface OkResponse {
    id: string;
    result: unknown;
}

export interface ErrorObject {
  code: number;
  message: string;
  data?: unknown;
}
export interface ErrResponse {
    id: string;
    error: ErrorObject;
}

export type RpcResponse = OkResponse | ErrResponse

export function isRpcResponse(m: RpcMessage): m is RpcResponse {
  return ((m as RpcResponse).id !== undefined) && ((m as RpcCall).method === undefined)
}

export type RpcMessage = RpcCall | RpcResponse

type RpcSender = (msg: RpcCall) => Promise<void>;
export class MessageHandler extends Target {
  messageIds: Map<string, [(value: any)=>void, (reason: any)=>void]> = new Map();

  sender: (msg: any) => void;

  static fromUrl(url: string) {
    return this.fromConnection(new WsConnection({ url }));
  }

  static fromConnection(wsCon: WsConnection) {
    return new this(wsCon.send.bind(wsCon), wsCon.onMessage);
  }

  constructor(
    sender: RpcSender,
    onMessage = new Target(),
  ) {
    super();
    this.sender = sender;
    onMessage.addListener(this.receive.bind(this));
  }

  async send(msg: RpcCall) {
    const out = Deferred();
    if (isRequest(msg)) {
      this.messageIds.set(msg.id, [out.resolve, out.reject]);
    } else {
      out.resolve(msg);
    }
    log.info('Sending Message: ', msg);
    await this.sender(msg);
    return out;
  }

  receive(msg: RpcMessage) {
    if (isRpcResponse(msg) && this.messageIds.has(msg.id)) {
      this.messageIds.get(msg.id)[0](msg);
    }
    this.dispatch(msg);
  }
}

export class WebClient extends MessageHandler {

  onEvent = new Target();

  onSendSetMessage = new Target();

  static fromUrl(url: string): WebClient {
    return new WebClient(new WsConnection({ url }));
  }

  wsConnection: WsConnection;

  constructor(
    wsCon: WsConnection,
  ) {
    super(wsCon.send.bind(wsCon), wsCon.onMessage);
    this.wsConnection = wsCon;
  }

  close() {
    this.wsConnection.close();
  }

  shutDown() {
    this.wsConnection.shutDown();
  }

  notify(method, params) {
    return this.send({
      timestamp: moment().toISOString(),
      method,
      ...(!isNullish(params) && { params }),
    })
  }

  request(method, params) {
    return this.send({
      id: uuidv4(),
      timestamp: moment().toISOString(),
      method,
      ...(!isNullish(params) && { params }),
    })
  }
}
