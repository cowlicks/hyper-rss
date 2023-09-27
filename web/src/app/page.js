import Image from 'next/image';

import WebSocket from 'isomorphic-ws';

const URL = 'ws://localhost:8080';

function talk (url) {
  const ws = new WebSocket(url);
  ws.onopen = function open () {
    console.log('connected');
    ws.send(Date.now());
  };

  ws.onclose = function close () {
    console.log('disconnected');
  };

  ws.onmessage = function incoming (data) {
    console.log(`Roundtrip time: ${Date.now() - data.data} ms`);

    setTimeout(function timeout () {
      ws.send(Date.now());
    }, 500);
  };
  return 'Ran websocket';
}

export default function Home () {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
    Hello World
    { talk(URL) }
    </main>
  );
}
