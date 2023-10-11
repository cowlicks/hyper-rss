import { join } from 'node:path';
import { ROOT_DIR } from '../../peer/src/const.js';

export const AGGERATOR_DIR_NAME = 'aggregator';
export const AGGREGATOR_ROOT = join(ROOT_DIR, AGGERATOR_DIR_NAME);
export const TEST_DATA_PATH = join(AGGREGATOR_ROOT, 'tests', 'data');
export const AGGREGATOR_TEST_FOO_STORAGE_NAME = 'agg_init';
export const AGGREGATOR_TEST_FOO_STORAGE = join(TEST_DATA_PATH, AGGREGATOR_TEST_FOO_STORAGE_NAME);
