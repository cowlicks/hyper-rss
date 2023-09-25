import Hyperbee from 'hyperbee';

const KEY_NAMESPACE = 'key',
  METADATA_NAMESPACE = 'metadata',
  ORDER_NAMESPACE = 'order';

const compareAndSwapIfDifferentValue = (prev, next) => {
  return prev.value !== next.value;
};

export class OrderedHyperbee extends Hyperbee {
  async getMetadataValue (key) {
    const out = await this.sub(METADATA_NAMESPACE).get(key);
    return JSON.parse(out.value.toString());
  }

  maybeUpdateMetadata (key, value) {
    return this.putMetadata(key, value, { cas: compareAndSwapIfDifferentValue });
  }

  putMetadata (key, value, options) {
    return this.sub(METADATA_NAMESPACE).put(key, value, options);
  }

  async hasKey (key) {
    return !!(await this.sub(KEY_NAMESPACE).get(key));
  }

  // TODO finish this.
  async putOrderdItem (key, value) {
    // get the order db
    const _orderDb = this.sub(ORDER_NAMESPACE);
    // Get highest index of the ordered db
    // const highest = _orderDb.length?
    // insert into _orderDb.put(highest + 1 (?), key)

    // insert it into the feed db
    const feedDb = this.sub(KEY_NAMESPACE);
    const out = await feedDb.put(key, value);
    return out;
  }

  getUnorderedFeedStream () {
    return this.sub(KEY_NAMESPACE).createReadStream();
  }
}
