import Image from 'next/image';

import WebSocket from 'isomorphic-ws';

import { WebClient } from '@hrss/utils/dist/messages';

const URL = 'ws://localhost:8080';

async function yo (url) {
  const c = WebClient.fromUrl(url);
  const res = await c.request('getFeedsMetadata', [{ wait: false, update: false }]);
  console.log(JSON.stringify(res, null, 2));
  return 'foo';
}

export default function Home () {
  setTimeout(() => yo(URL), 1000);
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
    Hello World
    </main>
  );
}
