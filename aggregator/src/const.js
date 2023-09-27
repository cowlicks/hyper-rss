import { join } from 'node:path';
import { ROOT_DIR } from '../../peer/src/const.js';

export const AGGERATOR_DIR_NAME = 'aggregator';
export const AGGREGATOR_ROOT = join(ROOT_DIR, AGGERATOR_DIR_NAME);
export const AGGREGATOR_TEST_DATA = join(AGGREGATOR_ROOT, 'tests', 'data');
