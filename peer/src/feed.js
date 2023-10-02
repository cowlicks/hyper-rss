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

  async * getFeedStream () {
    const feedDb = this.sub(KEY_NAMESPACE);
    for await (const orderObj of this.sub(ORDER_NAMESPACE).createReadStream({ reverse: true })) {
      const key = orderObj.value.toString();
      const result = await feedDb.get(key);
      yield result;
    }
  }
}
