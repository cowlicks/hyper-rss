'use client';
import { ApiProvider, useApiClient } from '@/client';
import { useEffect, useState } from 'react';

const URL = 'ws://localhost:8080';

function useFeedMetadata () {
  const client = useApiClient();
  const [data, setResult] = useState({ loading: true });
  useEffect(() => {
    (async () => {
      const result = await client.request('getFeedsMetadata', [{ wait: false, update: false }]);
      setResult({ data: result });
    })();
  }, [setResult, client]);

  return data;
}

function Foo () {
  const metadata = useFeedMetadata();
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
