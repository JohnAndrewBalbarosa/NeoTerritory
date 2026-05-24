import path from 'path';

const testRoot: string = process.env.TEST_RESULTS_DIR || path.join(__dirname, '..', '..', '..', 'test');
const uploadsDir: string = path.join(testRoot, '_uploads');
const outputsDir: string = testRoot;
const assembledCatalogsDir: string = path.join(testRoot, '_assembled_catalogs');

export { testRoot, uploadsDir, outputsDir, assembledCatalogsDir };
