// Hyperbee only provides a way to download the value of a key all at once
// If we want to be able to stream data from blobs, we would want to store it in something like hyperblobs

// TODO add a reader that can read our feed from the writer
import { CHAPO, XKCD } from './const.js';
import { _testReaderIntegration } from './reader.js';
import { withRssSubProcess } from './tools/forkedFeed.js';
import { wait } from './utils/async.js';
import { withTmpDir } from './utils/tests.js';
import { Writer, _testUpdateWriterIntegration } from './writer.js';
