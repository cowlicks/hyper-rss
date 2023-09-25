export class FifoMap extends Map {
  constructor (maxSize) {
    super();
    Object.assign(this, { maxSize });
  }

  set (key, val) {
    super.set(key, val);
    if (this.size > this.maxSize) {
      this.delete(this.keys().next().value);
    }
  }
}
