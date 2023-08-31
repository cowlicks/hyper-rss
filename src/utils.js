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

let _onExit = null;

export const getOnExit = () => {
  if (_onExit !== null) {
    return _onExit;
  }
  _onExit = new EventListener();
  process.on('exit', (...exitArgs) => _onExit.onEvent(exitArgs));
  return _onExit;
};
