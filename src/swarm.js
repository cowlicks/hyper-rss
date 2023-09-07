import Hyperswarm from 'hyperswarm';
import goodbye from 'graceful-goodbye';

export function swarmInit (discoveryKey, store) {
  const swarm = new Hyperswarm();
  goodbye(() => swarm.destroy());
  const peerDiscovery = swarm.join(discoveryKey);
  swarm.on('connection', conn => store.replicate(conn));
  return { swarm, peerDiscovery };
}
