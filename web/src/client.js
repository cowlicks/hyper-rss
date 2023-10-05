import { WebClient } from '@hrss/utils/dist/messages';
import { createContext, useContext, useEffect, useState } from 'react';

export const ApiContext = createContext();
const URL = 'ws://localhost:8080';

export function ApiProvider ({ children }) {
  const [client] = useState(() => WebClient.fromUrl(URL));
  useEffect(() => {
    return () => client.shutDown();
  }, [client]);
  return (
    <ApiContext.Provider value={client}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApiClient () {
  return useContext(ApiContext);
}
