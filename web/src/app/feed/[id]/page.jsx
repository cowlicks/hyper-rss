'use client';
import { useGetReaderFeed } from '@/client';

export default function Feed ({ params: { id } }) {
  const result = useGetReaderFeed(id);
  return (
    <div>
    {JSON.stringify(result, null, 2)}
    </div>
  );
}
