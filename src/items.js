import Hyperbee from 'hyperbee';

export class Items {
  constructor({core, hyperbeeOptions}) {
    this.core = core;
    this.db = new Hyperbee(core, hyperbeeOptions);
  }
}

const defaultRssItemHasher = ({ guid }) => guid

// TODO use Hyperbee.batch
export async function itemsNotHyperized(rssFeed, hyperbeeItemsDb, { hasher = defaultRssItemHasher } = {}) {
  const out = []
  let dbReady = false;
  for (const rssItem of [...rssFeed].reverse()) {
    if (!dbReady) {
      await hyperbeeItemsDb.ready();
      dbReady = true;
    }

    const key = hasher(rssItem)
    const hyperItemRes = await hyperbeeItemsDb.get(key)
    if (hyperItemRes === null) {
      console.log(`No key: ${key}`);
      out.push({key, rssItem})
    } else {
    /*
      console.log(`
        HAS key ${key}
        hitem ${hyperItemRes}
        ritem ${rssItem.title}
      `);
    */
    }
  }
  return out
}


console.log(Hyperbee);
