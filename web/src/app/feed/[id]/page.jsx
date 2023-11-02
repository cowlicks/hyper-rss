'use client';
import * as DOMPurify from 'dompurify';
import { useGetReaderFeed } from '@/client';

function Player ({ enclosure }) {
  if (enclosure.type === 'audio/mpeg') {
    return (
      <audio controls src={enclosure.url}>
        <a href={enclosure.url}> Download audio </a>
      </audio>
    );
  }
}
// TODO look at rss.xml and see what kinda content we can get from these
function Enclosure ({ enclosure }) {
  if (!enclosure) {
    return (<></>);
  }

  return (
    <div className="Enclosure">
      Enclosure
      <pre>{JSON.stringify(enclosure, null, 2)}</pre>
      <Player enclosure={enclosure} />
    </div>
  );
}

function Item ({ item }) {
  console.log(item);
  const safeContent = {
    // __html: item.content,
    __html: DOMPurify.sanitize(item.content),
  };

  return (
    <div className="Item">
      <div className="Item__title">{item.title}</div>
      <div className="Item__content" dangerouslySetInnerHTML={safeContent} />
      <Enclosure {...{ enclosure: item.enclosure }} />
    </div>
  );
}

export default function Feed ({ params: { id } }) {
  const { loading, data, error } = useGetReaderFeed(id);
  if (loading) {
    return <div>...loading</div>;
  }
  if (error) {
    return <div>Error: {JSON.stringify(error, null, 2)}</div>;
  }

  return (
    <div className="Feed">
    {data.map(({ key, value }) => {
      const k = Buffer.from(key.data).toString();
      const item = JSON.parse(Buffer.from(value.data).toString());
      return (
        <Item key={k} {...{ item }} />
      );
    })}
    </div>
  );
}
