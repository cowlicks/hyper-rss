const defaultRssItemHasher = ({ guid }) => guid;

export async function itemsNotHyperized (rssFeed, hyperbeeItemsDb, { hasher = defaultRssItemHasher } = {}) {
  const out = [];
  await hyperbeeItemsDb.ready();
  const batcher = hyperbeeItemsDb.batch();

  for (const rssItem of [...rssFeed].reverse()) {
    const key = hasher(rssItem);
    const hyperItemRes = await batcher.get(key);
    if (hyperItemRes === null) {
      out.push({ key, rssItem });
    }
  }
  await batcher.flush();
  return out;
}

async function maybeHandleEnclosure (item, blobs = {}) {
}

export async function transformItem (item) {
}
