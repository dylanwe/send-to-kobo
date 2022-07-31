import { spawn } from 'child_process';
import filteType from 'file-type';
import { unlink } from 'fs';
import { basename, dirname } from 'path';
import { app } from "./../index.js";
import { expireKey } from './key.js';

const TYPE_EPUB = 'application/epub+zip';
const TYPE_MOBI = 'application/x-mobipocket-ebook';

const allowedTypes = [
    TYPE_EPUB,
    TYPE_MOBI,
    'application/pdf',
    'application/vnd.comicbook+zip',
    'application/vnd.comicbook-rar',
    'text/html',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
];

/**
 * Send a flash message
 *
 * @param {*} ctx context of the user
 * @param {JSON} data the data to send in the message
 */
const flash = (ctx, data) => {
    console.log(data);

    ctx.cookies.set('flash', encodeURIComponent(JSON.stringify(data)), {
        overwrite: true,
        httpOnly: false,
    });
};

/**
 * Convert the uploaded book to .mobi
 * 
 * @param {*} ctx router
 * @param {*} filename the name of the file
 * @returns data of convertion
 */
const convertToMobi = async (ctx, filename) => {
    const returnValues = {
        conversion: '',
        filename,
        data: null
    }

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
                if (err)
                    console.error(err);
                else
                    console.log('Removed file', ctx.request.file.path);
            });
            unlink(
                ctx.request.file.path.replace(/\.epub$/i, '.mobi8'),
                (err) => {
                    if (err)
                        console.error(err);

                    else
                        console.log(
                            'Removed file',
                            ctx.request.file.path.replace(
                                /\.epub$/i,
                                '.mobi8'
                            )
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
}

/**
 * Convert the uploaded book to .kepub
 * 
 * @param {*} ctx router
 * @param {*} filename the name of the file
 * @returns data of convertion
 */
const convertToKepub = async (ctx, filename) => {
    const returnValues = {
        conversion: '',
        filename,
        data: null
    }

    returnValues.conversion = 'kepubify';
    const outname = ctx.request.file.path.replace(
        /\.epub$/i,
        '.kepub.epub'
    );
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
}

/**
 * Upload a file to the uploads folder
 * 
 * @param {*} ctx the router
 * @returns ❌  ?
 */
export const uploadToFolder = async (ctx) => {
    const key = ctx.request.body.key.toUpperCase();

    if (ctx.request.file) {
        console.log('Uploaded file:', ctx.request.file);
    }

    if (!ctx.keys.has(key)) {
        flash(ctx, {
            message: 'Unknown key ' + key,
            success: false,
        });
        ctx.redirect('back', '/');
        if (ctx.request.file) {
            unlink(ctx.request.file.path, (err) => {
                if (err) console.error(err);
                else console.log('Removed file', ctx.request.file.path);
            });
        }
        return;
    }

    if (!ctx.request.file || ctx.request.file.size === 0) {
        flash(ctx, {
            message: 'Invalid file submitted',
            success: false,
            key: key,
        });
        ctx.redirect('back', '/');
        if (ctx.request.file) {
            unlink(ctx.request.file.path, (err) => {
                if (err) console.error(err);
                else console.log('Removed file', ctx.request.file.path);
            });
        }
        return;
    }

    const mimetype = ctx.request.file.mimetype;

    const type = await filteType.fromFile(ctx.request.file.path);

    if (!type || !allowedTypes.includes(type.mime)) {
        flash(ctx, {
            message:
                'Uploaded file is of an invalid type: ' +
                ctx.request.file.originalname +
                ' (' +
                (type ? type.mime : 'unknown mimetype') +
                ')',
            success: false,
            key: key,
        });
        ctx.redirect('back', '/');
        unlink(ctx.request.file.path, (err) => {
            if (err) console.error(err);
            else console.log('Removed file', ctx.request.file.path);
        });
        return;
    }

    const info = ctx.keys.get(key);
    expireKey(key, app.context);

    let data = null;
    let filename = ctx.request.file.originalname;
    let conversion = null;

    if (mimetype === TYPE_EPUB && info.agent.includes('Kindle')) {
        // convert to .mobi
        const convertionData = await convertToMobi(ctx, filename);
        conversion = convertionData.conversion;
        filename = convertionData.filename;
        data = convertionData.data;
    } else if (
        mimetype === TYPE_EPUB &&
        info.agent.includes('Kobo') &&
        ctx.request.body.kepubify
    ) {
        // convert to Kobo EPUB
        const convertionData = await convertToKepub(ctx, filename);
        conversion = convertionData.conversion;
        filename = convertionData.filename;
        data = convertionData.data;
    } else {
        // No conversion
        data = ctx.request.file.path;
    }

    expireKey(key, app.context);
    if (info.file && info.file.path) {
        await new Promise((resolve, reject) =>
            unlink(info.file.path, (err) => {
                if (err) return reject(err);
                else
                    console.log(
                        'Removed previously uploaded file',
                        info.file.path
                    );
                resolve();
            })
        );
    }
    info.file = {
        name: filename,
        path: data,
        // size: ctx.request.file.size,
        uploaded: new Date(),
    };

    flash(ctx, {
        message:
            'Upload successful!<br/>' +
            (conversion
                ? ' Ebook was converted with ' + conversion + ' and sent'
                : ' Sent') +
            ' to ' +
            (info.agent.includes('Kobo')
                ? 'a Kobo device.'
                : info.agent.includes('Kindle')
                ? 'a Kindle device.'
                : 'a device.') +
            '<br/>Filename: ' +
            filename,
        success: true,
        key: key,
    });
    ctx.redirect('back', '/');
};