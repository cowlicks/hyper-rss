const DEFAULT_SERVER_PORT = 8080;
const DEFAULT_LOG_LEVEL = 1;
const DEFAULT_WS_RECONNECT_INTERVAL = 1e3;
const DEFAULT_TIMEOUT = 1e3 * 5; // 5 seconds
const DEFAULT_KEEPALIVE_MS = 1e3 * 25; // 25 seconds

export const RPC_ERROR_CODE_METHOD_NOT_FOUND = -32601;

function idempotentParseFloat (x: string | number) {
  if (typeof x === 'number') return x;
  return parseFloat(x);
}

export default {
  LOG_LEVEL: idempotentParseFloat(process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL),
  WS_RECONNECT_INTERVAL: idempotentParseFloat(
    process.env.WS_RECONNECT_INTERVAL ?? DEFAULT_WS_RECONNECT_INTERVAL
  ),
  TIMEOUT: idempotentParseFloat(
    process.env.TIMEOUT ?? DEFAULT_TIMEOUT
  ),
  KEEPALIVE_MS: idempotentParseFloat(
    process.env.DEFAULT_KEEPALIVE_MS ?? DEFAULT_KEEPALIVE_MS
  ),
  SERVER_PORT: idempotentParseFloat(
    process.env.SERVER_PORT ?? DEFAULT_SERVER_PORT
  )
};
