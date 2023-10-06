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

function useGetFeedsMetadata () {
  const [params] = useState([{ wait: false, update: false }]);
  return useRpcCall('getFeedsMetadata', params);
}

function Feeds () {
  const feedsMetadata = useGetFeedsMetadata();
  return (<code><pre>{ feedsMetadata.loading ? '...loading' : feedsMetadata.data.result.map(x => (<Feed key={x[0]} metadata={x} />))}</pre></code>);
}

function Feed ({ metadata }) {
  const [discoveryKey, feedAttributes] = metadata;
  return (
      <div className="Feed">
        <div className="Feed__DiscoveryKey">
          <DiscoveryKey {...{ discoveryKey }} />
        </div>
        <div className="Feed__FeedAttributes">
          <FeedAttributes {...{ feedAttributes }} />
        </div>
      </div>
  );
}

function DiscoveryKey ({ discoveryKey }) {
  return (<a href={`feed/${discoveryKey}`} className="DiscoveryKey">{discoveryKey}</a>);
}

function FeedAttributes ({ feedAttributes }) {
  return (
    <div className="FeedAttributes">
      {JSON.stringify(feedAttributes, null, 2)}
    </div>
  );
}

export default function Home () {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <ApiProvider>
      <Feeds/>
      </ApiProvider>
    </main>
  );
}
