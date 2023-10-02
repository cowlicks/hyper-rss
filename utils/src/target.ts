export const noop = () => {};
export const passThrough = <T>(x: T): T => x;

export class Target {
  funcs: Set<Function> = new Set();

  onDispatch: Function;

  beforeDispatch: Function;

  afterDispatch: Function;

  constructor({
    onDispatch = noop,
    beforeDispatch = passThrough,
    afterDispatch = passThrough,
  }: {
    onDispatch?: Function,
    beforeDispatch?: Function,
    afterDispatch?: Function,
  } = {}) {
    this.beforeDispatch = beforeDispatch;
    this.afterDispatch = afterDispatch;
    this.onDispatch = onDispatch;
  }

  addListener(f: Function) {
    this.funcs.add(f);
    return () => this.removeListener(f);
  }

  addListenerOnce(f) {
    const removeMe = (...x) => {
      this.removeListener(removeMe);
      return f(...x);
    };
    return this.addListener(removeMe);
  }

  removeListener(f: Function) {
    return this.funcs.delete(f);
  }

  async dispatch(e: unknown) {
    let cancel = false;
    const x = this.beforeDispatch(e, () => (cancel = true));
    if (cancel) return;

    // eslint-disable-next-line consistent-return
    return this.afterDispatch(
      Promise.all(
        [
          this.onDispatch,
          ...this.funcs,
        ].map((f) => f(x)),
      ),
    );
  }
}

interface NamesToListeners {
  [k: string]: Function;
}
export class NamedTarget {
  namedListeners: Map<string, Target>

  constructor() {
    this.namedListeners = new Map();
  }

  on(name: string, listener: Function) {
    this.register({ [name]: listener });
  }

  register(nameToListenerObject: NamesToListeners) {
    Object.entries(nameToListenerObject).forEach(([name, listener]) => {
      this.addListener(name, listener);
    });
  }

  addListener(name, listener) {
    if (!this.namedListeners.has(name)) {
      this.namedListeners.set(name, new Target());
    }
    return this.namedListeners.get(name).addListener(listener);
  }

  addListenerOnce(name, listener) {
    if (!this.namedListeners.has(name)) {
      this.namedListeners.set(name, new Target());
    }
    return this.namedListeners.get(name).addListenerOnce(listener);
  }

  dispatch(name: string, e?: unknown) {
    return this.namedListeners.get(name)?.dispatch(e);
  }
}
