'use client';
import { ApiProvider, useApiClient } from '@/client';
import { useEffect, useState } from 'react';

function useRpcCall (method, params) {
  const client = useApiClient();
  const [data, setData] = useState({ loading: true });
  useEffect(() => {
    (async () => {
      const result = await client.request(method, params);
      setData({ data: result });
    })();
  }, [setData, client, method, params]);

  return data;
}

function useGetFeedMetadata () {
  const [params] = useState([{ wait: false, update: false }]);
  return useRpcCall('getFeedsMetadata', params);
}

function Foo () {
  const metadata = useGetFeedMetadata();
  return (<code><pre>{ metadata.loading ? '...loading' : JSON.stringify(metadata.data, null, 2)}</pre></code>);
}
export default function Home () {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <ApiProvider>
      <Foo/>
      </ApiProvider>
    </main>
  );
}
