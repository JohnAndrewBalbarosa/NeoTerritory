import path from 'path';

const testRoot: string = process.env.TEST_RESULTS_DIR || path.join(__dirname, '..', '..', '..', 'test');
const uploadsDir: string = path.join(testRoot, '_uploads');
const outputsDir: string = testRoot;

export { testRoot, uploadsDir, outputsDir };
