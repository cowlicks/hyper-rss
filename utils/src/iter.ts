export interface IterableKeyedObj<T> {
  [key:string]: T[];
}

export function* range(n: number): Iterable<number> {
  for (let i = 0; i < n; i++) {
    yield i;
  }
}

// like python enumerate
export function* enumerate<T>(gen: Iterable<T>): Iterable<[number, T]> {
  let count = 0;
  for (const x of gen) {
    yield [count, x];
    count += 1;
  }
}

export function* product(...gens) {
  for (const a of (gens.shift() ?? [])) {
    if (!gens.length) {
      yield [a];
    } else {
      for (const b of product(...gens)) {
        yield [a, ...b];
      }
    }
  }
  yield* [];
}

export function* iterMap(iterable, callback) {
  for (const x of iterable) {
    yield callback(x);
  }
}

// ensure something is an iterator
// converts iterables to iterators
// has no effect on iterators
// useful for handleling something that could be a array, or, map, but we want a .next() method
function* iter(it) {
  yield* it;
}

// like python's builtin zip
export function* zip(...args) {
  const gens = args.map(iter);
  while (true) {
    const out = [];
    for (const g of gens) {
      const r = g.next();
      if (r.done) return;
      out.push(r.value);
    }
    yield out;
  }
}

export function* zipLongest(...args) {
  const gens = args.map(iter);
  const nArgs = args.length;
  while (true) {
    const out = Array(nArgs);
    let doneCount = 0;
    for (const [i, g] of enumerate(gens)) {
      const r = g.next();
      if (r.done) {
        doneCount += 1;
        if (doneCount === nArgs) {
          return;
        }
      } else {
        out[i] = r.value;
      }
    }
    yield out;
  }
}

export function* chain<T>(...args: Iterable<T>[]): Iterable<T> {
  for (const iterable of args) {
    for (const b of iterable) {
      yield b;
    }
  }
}

export function* take<T>(n: number, iterable: Iterable<T>): Generator<T[]> {
  const out = [];
  for (const x of iterable) {
    out.push(x);
    if (out.length === n) {
      yield [...out];
      out.length = 0;
    }
  }
  yield out;
}
