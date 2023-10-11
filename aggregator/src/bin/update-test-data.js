import { cp } from 'node:fs/promises';

import { CHAPO, SKEPTOID, XKCD } from '@hrss/peer/src/const.js';
import { withReader, withUpdatedWriter } from '@hrss/peer/src/utils/tests.js';
import { AGG_DATA_DIR_WITH_TWO_FEEDS } from '../const.js';
import { join } from 'node:path';

// TODO can we replace all this this getFoo with an update?
await withUpdatedWriter(XKCD, async (xkcdWriter) => {
  await withReader(xkcdWriter.discoveryKeyString(), async (xkcdReader) => {
    console.log(await xkcdReader.getMetadata());
    console.log(await xkcdReader.getFeed());
    console.log(await xkcdReader.getKeysAndBlobs());
    await withUpdatedWriter(CHAPO, async (chapoWriter) => {
      await withReader(chapoWriter.discoveryKeyString(), async (chapoReader) => {
        console.log(await chapoReader.getMetadata());
        console.log(await chapoReader.getFeed());
        console.log(await chapoReader.getKeysAndBlobs());
        await withUpdatedWriter(SKEPTOID, async (skeptoidWriter) => {
          await withReader(skeptoidWriter.discoveryKeyString(), async (skeptoidReader) => {
            console.log(await skeptoidReader.getMetadata());
            console.log(await skeptoidReader.getFeed());

            console.log(await skeptoidReader.getKeysAndBlobs());
            console.log('Updating test data');
            await Promise.all([
              cp(xkcdReader.storageName, join(AGG_DATA_DIR_WITH_TWO_FEEDS, xkcdWriter.discoveryKeyString()), { recursive: true }),
              cp(chapoReader.storageName, join(AGG_DATA_DIR_WITH_TWO_FEEDS, chapoWriter.discoveryKeyString()), { recursive: true }),
              cp(skeptoidReader.storageName, join(AGG_DATA_DIR_WITH_TWO_FEEDS, skeptoidWriter.discoveryKeyString()), { recursive: true }),
            ]);
            console.log('done updating test data');
          });
        });
      });
    });
  });
});