import Hyperbee from 'hyperbee';
import { RSS_METADATA_FIELDS } from './const.js';

const KEY_NAMESPACE = 'key',
  METADATA_NAMESPACE = 'metadata',
  ORDER_NAMESPACE = 'order';

const compareAndSwapIfDifferentValue = (prev, next) => {
  return prev.value !== next.value;
};

const N_ORDER_DIGITS_DEFAULT = 6;

export function numberFromOrderString (str) {
  return parseInt(str, 10);
}

function leftPad (str, padChar, size) {
  if (str.length < size) {
    return leftPad(padChar + str, padChar, size);
  }
  return str;
}

export function orderStringFromNumber (num, nDigits = N_ORDER_DIGITS_DEFAULT) {
  return leftPad(num.toString(), '0', nDigits);
}

/*
 * A key value store that preserves insertion order.
 * Also has seperate storage for metadata.
 *
 * We keep ordering using two sub-databases within the Hyperbee. The two
 * sub-databases are namespaceds with key prefixes defined by KEY_NAMESPACE and
 * ORDER_NAMESPACE. For a given `key` and `value`, we store a mapping of the
 * ordering index `i` to the `key` in the ORDER_NAMESPACE. Then in
 * KEY_NAMESPACE we store the `key` to `value`. So to get the `(key, value)`
 * pairs in order, we iterate over the `ORDER_NAMESPACE` to get it's values
 * (the `key`s) then use these `key`s to get the `value`s.
 *
 * Metadata is stored in a seperate METADATA_NAMESPACE.
 */
export class OrderedHyperbee extends Hyperbee {
  async getMetadataValue (key, options) {
    const out = await this.sub(METADATA_NAMESPACE).get(key, { ...options });
    if (!out) return out;
    return JSON.parse(out.value.toString());
  }

  maybeUpdateMetadata (key, value) {
    return this.putMetadata(key, value, { cas: compareAndSwapIfDifferentValue });
  }

  putMetadata (key, value, options) {
    return this.sub(METADATA_NAMESPACE).put(key, value, options);
  }

  async getMetadata (options) {
    const out = {};
    for (const field of RSS_METADATA_FIELDS) {
      out[field] = await this.getMetadataValue(field, options);
    }
    return out;
  }

  async hasKey (key) {
    return !!(await this.sub(KEY_NAMESPACE).get(key));
  }

  async putOrderdItem (key, value) {
    // Should we check if the key exists already?
    await this.putNextInOrder(key);
    const out = await this.sub(KEY_NAMESPACE).put(key, value);
    return out;
  }

  async getNextHighest () {
    const orderDb = this.sub(ORDER_NAMESPACE);
    const result = await orderDb.peek({ reverse: true });
    if (!result) {
      return 0;
    }
    const orderStr = parseInt(result.key.toString(), 10);
    return numberFromOrderString(orderStr) + 1;
  }

  async putNextInOrder (feedItemKey) {
    const highestOrder = await this.getNextHighest();
    const orderKey = orderStringFromNumber(highestOrder);
    return await this.sub(ORDER_NAMESPACE).put(orderKey, feedItemKey);
  }

  getUnorderedFeedStream () {
    return this.sub(KEY_NAMESPACE).createReadStream();
  }

  async * getFeedStream (opts) {
    const feedDb = this.sub(KEY_NAMESPACE);
    for await (const orderObj of this.sub(ORDER_NAMESPACE).createReadStream({ reverse: true, ...opts })) {
      const orderIndex = parseInt(orderObj.key.toString(), 10);
      const key = orderObj.value.toString();
      const result = await feedDb.get(key, { ...opts });
      yield { ...result, orderIndex };
    }
  }
}
