'use client';
import { isNullish } from '@hrss/utils';
import { WebClient } from '@hrss/utils/dist/messages';
import { createContext, useContext, useEffect, useState } from 'react';

export const ApiContext = createContext();
const URL = 'ws://localhost:8080';

let _client = null;
function getClient () {
  if (_client === null) {
    _client = WebClient.fromUrl(URL);
  }
  return _client;
}

export function ApiProvider ({ children }) {
  const [client] = useState(() => getClient());
  return (
    <ApiContext.Provider value={client}>
      {children}
    </ApiContext.Provider>
  );
}

export function useRpcCall (method, params) {
  const client = useApiClient();
  const [data, setData] = useState({ loading: true });
  useEffect(() => {
    (async () => {
      const { result, error } = await client.request(method, params);
      setData({
        ...(result !== undefined && { data: result }),
        ...(error !== undefined && { error }),
      });
    })();
  }, [setData, client, method, params]);

  return data;
}

export function useGetFeedsMetadata () {
  const [params] = useState([{ wait: false, update: false }]);
  return useRpcCall('getFeedsMetadata', params);
}

export function useGetReaderFeed (id) {
  const [params] = useState([id, { wait: false, update: false }]);
  return useRpcCall('getReaderFeed', params);
}

export function useApiClient () {
  return useContext(ApiContext);
}
