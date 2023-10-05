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

export function useApiClient () {
  return useContext(ApiContext);
}
