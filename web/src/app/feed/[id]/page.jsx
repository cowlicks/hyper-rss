'use client';
import * as DOMPurify from 'dompurify';
import { useGetReaderFeed } from '@/client';

export default function Feed ({ params: { id } }) {
  const { loading, data, error } = useGetReaderFeed(id);
  if (loading) {
    return <div>...loading</div>;
  }
  if (error) {
    return <div>Error: {JSON.stringify(error, null, 2)}</div>;
  }

  return (
    <div>
    {data.map(({ seq, key, value }, index) => {
      const k = Buffer.from(key.data);
      const obj = JSON.parse(Buffer.from(value.data).toString());
      const safeContent = {
        __html: DOMPurify.sanitize(obj.content),
      };
      return (
        <div key={index}>
          <div>{obj.title}</div>
          <div dangerouslySetInnerHTML={safeContent} />
        </div>
      );
    })}
    </div>
  );
}
