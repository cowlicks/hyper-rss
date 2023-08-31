import Hyperbee from 'hyperbee';

export class Items {
  constructor ({ core, hyperbeeOptions }) {
    this.core = core;
    this.db = new Hyperbee(core, hyperbeeOptions);
  }
}

const defaultRssItemHasher = ({ guid }) => guid;

// TODO use Hyperbee.batch
export async function itemsNotHyperized (rssFeed, hyperbeeItemsDb, { hasher = defaultRssItemHasher } = {}) {
  const out = [];
  await hyperbeeItemsDb.ready();
  const batcher = hyperbeeItemsDb.batch();

  for (const rssItem of [...rssFeed].reverse()) {
    const key = hasher(rssItem);
    const hyperItemRes = await batcher.get(key);
    if (hyperItemRes === null) {
      console.log(`No key: ${key}`);
      out.push({ key, rssItem });
    } else {
      console.log(`
        HAS key ${key}
        hitem ${hyperItemRes}
        ritem ${rssItem.title}
      `);
    }
  }
  await batcher.flush();
  return out;
}
