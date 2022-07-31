import filteType from 'file-type';
import { unlink } from 'fs';
import { app } from './../index.js';
import { expireKey } from './key.js';
import { convertBook } from './../utils/convert.js';

const TYPE_EPUB = 'application/epub+zip';

const allowedTypes = [
    TYPE_EPUB,
    'application/x-mobipocket-ebook',
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
 * Upload a file to the uploads folder
 *
 * @param {*} ctx the router
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

    const convertionData = await convertBook(ctx, mimetype, info);

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
        name: convertionData.filename,
        path: convertionData.data,
        uploaded: new Date(),
    };

    // send message if upload was successful
    flash(ctx, {
        message: 'Upload successful!',
        success: true,
        key: key,
    });

    // redirect back to homepage
    ctx.redirect('back', '/');
};
