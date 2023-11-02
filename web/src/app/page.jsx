'use client';
import { useGetFeedsMetadata } from '@/client';

function Feeds () {
  const feedsMetadata = useGetFeedsMetadata();
  return (<code>{ feedsMetadata.loading ? '...loading' : feedsMetadata.data.map(x => (<FeedOuter key={x[0]} metadata={x} />))}</code>);
}

function FeedOuter ({ metadata }) {
  const [discoveryKey, feedAttributes] = metadata;
  return (
      <div className="FeedOuter">
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
  return (<a href={`feed/${discoveryKey}/`} className="DiscoveryKey">{discoveryKey}</a>);
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
      <Feeds/>
    </main>
  );
}
