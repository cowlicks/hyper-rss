// For fully featured listener see privacypossum src/js/utils:listenerMixin
class EventListener {
  constructor () {
    this.funcs = new Set();
  }

  addListener (func) {
    this.funcs.add(func);
  }

  onEvent (event_) {
    return this.funcs.map(func => func(event_));
  }
}

const EXIT_EVENTS = [
  'exit',
  'SIGINT',
  'SIGTERM'
];
let _onExit = null;

export const getOnExit = () => {
  if (_onExit !== null) {
    return _onExit;
  }
  _onExit = new EventListener();
  EXIT_EVENTS.forEach(eventName => process.on(eventName, (...exitArgs) => _onExit.onEvent(exitArgs)));
  return _onExit;
};
