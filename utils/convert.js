import { spawn } from 'child_process';
import { unlink } from 'fs';
import { basename, dirname } from 'path';

/**
 * Convert the uploaded book to .mobi
 *
 * @param {*} ctx router
 * @param {*} filename the name of the file
 * @returns data of convertion
 */
export const convertToMobi = async (ctx, filename) => {
    const returnValues = {
        conversion: '',
        filename,
        data: null,
    };

    returnValues.conversion = 'kindlegen';
    const outname = ctx.request.file.path.replace(/\.epub$/i, '.mobi');
    returnValues.filename = filename
        .replace(/\.kepub\.epub$/i, '.epub')
        .replace(/\.epub$/i, '.mobi');

    returnValues.data = await new Promise((resolve, reject) => {
        const kindlegen = spawn(
            'kindlegen',
            [
                basename(ctx.request.file.path),
                '-dont_append_source',
                '-c1',
                '-o',
                basename(outname),
            ],
            {
                stdio: 'inherit',
                cwd: dirname(ctx.request.file.path),
            }
        );
        kindlegen.once('close', (code) => {
            unlink(ctx.request.file.path, (err) => {
                if (err) console.error(err);
                else console.log('Removed file', ctx.request.file.path);
            });
            unlink(
                ctx.request.file.path.replace(/\.epub$/i, '.mobi8'),
                (err) => {
                    if (err) console.error(err);
                    else
                        console.log(
                            'Removed file',
                            ctx.request.file.path.replace(/\.epub$/i, '.mobi8')
                        );
                }
            );
            if (code !== 0) {
                console.warn('kindlegen error code ' + code);
            }

            resolve(outname);
        });
    });

    return returnValues;
};

/**
 * Convert the uploaded book to .kepub
 *
 * @param {*} ctx router
 * @param {*} filename the name of the file
 * @returns data of convertion
 */
export const convertToKepub = async (ctx, filename) => {
    const returnValues = {
        conversion: '',
        filename,
        data: null,
    };

    returnValues.conversion = 'kepubify';
    const outname = ctx.request.file.path.replace(/\.epub$/i, '.kepub.epub');
    returnValues.filename = filename
        .replace(/\.kepub\.epub$/i, '.epub')
        .replace(/\.epub$/i, '.kepub.epub');

    returnValues.data = await new Promise((resolve, reject) => {
        const kepubify = spawn(
            'kepubify',
            [
                '-v',
                '-u',
                '-o',
                basename(outname),
                basename(ctx.request.file.path),
            ],
            {
                stdio: 'inherit',
                cwd: dirname(ctx.request.file.path),
            }
        );
        kepubify.once('close', (code) => {
            unlink(ctx.request.file.path, (err) => {
                if (err) console.error(err);
                else console.log('Removed file', ctx.request.file.path);
            });
            if (code !== 0) {
                reject('kepubify error code ' + code);
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
 * @param {*} ctx router
 * @param {*} mimetype file type detector
 * @param {*} info info of the book
 * @returns the data after the convertion
 */
export const convertBook = async (ctx, mimetype, info) => {
    const TYPE_EPUB = 'application/epub+zip';

    // the data after convertion
    let convertionData = {
        conversion: null,
        filename: ctx.request.file.originalname,
        data: null,
    };

    if (mimetype === TYPE_EPUB && info.agent.includes('Kindle')) {
        // convert to .mobi
        convertionData = await convertToMobi(ctx, convertionData.filename);
    } else if (
        mimetype === TYPE_EPUB &&
        info.agent.includes('Kobo') &&
        ctx.request.body.kepubify
    ) {
        // convert to Kobo EPUB
        convertionData = await convertToKepub(ctx, convertionData.filename);
    } else {
        // No conversion
        convertionData.data = ctx.request.file.path;
    }

    return convertionData;
};
