import { copyFileSync, unlinkSync, existsSync } from 'fs';
import { convertToKepub } from './convert';

/**
 * Remove sample kepub if it exists
 */
const removeSampleFiles = () => {
    if (existsSync('uploads-test/sample-copy.kepub.epub')) {
        unlinkSync('uploads-test/sample-copy.kepub.epub');
    }

    if (existsSync('uploads-test/sample-copy.epub')) {
        unlinkSync('uploads-test/sample-copy.epub');
    }
};

beforeEach(() => {
    removeSampleFiles();
});

afterEach(() => {
    removeSampleFiles();
});

describe('convert', () => {
    it('Should change a .epub to .kepub', async () => {
        // copy sample file
        copyFileSync(
            'uploads-test/sample.epub',
            'uploads-test/sample-copy.epub'
        );

        // sample copy info
        const sample = {
            path: 'uploads-test/sample-copy.epub',
            filename: 'sample-copy.epub',
        };

        const convertedValues = await convertToKepub(
            sample.path,
            sample.filename
        );

        expect(convertedValues.data).toBe('uploads-test/sample-copy.kepub.epub');
    });
});
