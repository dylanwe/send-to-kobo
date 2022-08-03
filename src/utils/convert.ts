import { spawn } from 'child_process';
import { unlink } from 'fs';
import { basename, dirname } from 'path';

/**
 * Convert a book to another format
 *
 * @param pathOfFile the path of the file
 * @param filename the name of the file
 * @returns data of conversion
 */
const convertToKepub = async (
    pathOfFile: string,
    filename: string
): Promise<ConversionData> => {
    const returnValues: ConversionData = {
        conversion: 'kepubify',
        filename,
        data: null,
    };

    const outname = pathOfFile.replace(/\.epub$/i, '.kepub.epub');

    returnValues.filename = filename
        .replace(/\.kepub\.epub$/i, '.epub')
        .replace(/\.epub$/i, '.kepub.epub');

    returnValues.data = await new Promise((resolve, reject) => {
        // convert book
        let converter;
        try {
            converter = spawn(
                'kepubify',
                [
                    '-v',
                    '-u',
                    '-o',
                    basename(outname),
                    basename(pathOfFile),
                ],
                {
                    stdio: 'inherit',
                    cwd: dirname(pathOfFile),
                }
            );
        } catch (error) {
            throw new Error(
                "Conversion didn't work check if cli tools for conversion are installed"
            );
        }

        // close converter
        converter.once('close', (code) => {
            unlink(pathOfFile, (err) => {
                if (err) console.error(err);
                else console.log('Removed file', pathOfFile);
            });

            // show error code if there is an error
            if (code !== 0) {
                reject(`kepubify error code ${code}`);
                return;
            }

            resolve(outname);
        });
    });

    return returnValues;
};

/**
 * Convert a book to a different type
 *
 * @param pathOfFile the path of the book to convert
 * @param kepubify if the book should be kepubified
 * @param originalFileName the original name of the file
 * @param mimetype the type of the book
 * @param agent what device the user is using
 */
export const convertBook = async (
    pathOfFile: string,
    kepubify: boolean,
    originalFileName: string,
    mimetype: any,
    agent: any
) => {
    const TYPE_EPUB = 'application/epub+zip';

    // the data after convertion
    let convertionData: ConversionData = {
        conversion: '',
        filename: originalFileName,
        data: null,
    };

    if (mimetype === TYPE_EPUB && agent.includes('Kobo') && kepubify) {
        convertionData = await convertToKepub(pathOfFile, originalFileName);
    } else {
        // No conversion
        convertionData.data = pathOfFile;
    }

    return convertionData;
};
