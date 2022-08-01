import filteType from 'file-type';
import multer from '@koa/multer';
import { extname } from 'path';
import { unlink } from 'fs';
import { app } from '../index.js';
import { expireKey } from './key.js';
import { convertBook } from '../utils/convert.js';
import { Context, Request } from 'koa';

const TYPE_EPUB = 'application/epub+zip';
const allowedExtensions = ['epub', 'mobi', 'pdf', 'cbz', 'cbr', 'html', 'txt'];
const maxFileSize = 1024 * 1024 * 800; // 800 MB
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
    ctx.cookies.set('flash', encodeURIComponent(JSON.stringify(data)), {
        overwrite: true,
        httpOnly: false,
    });
};

/**
 * Upload a file to the uploads folder
 */
export const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads');
        },
        filename: (req, file, cb) => {
            const uniqueSuffix =
                Date.now() + '-' + Math.floor(Math.random() * 1e9);
            cb(
                null,
                file.fieldname +
                    '-' +
                    uniqueSuffix +
                    extname(file.originalname).toLowerCase()
            );
        },
    }),
    limits: {
        fileSize: maxFileSize,
        files: 1,
    },
    fileFilter: (req: Request, file: any, cb: any) => {
        console.log('Incoming file:', file);
        const key = req.body.key.toUpperCase();
        if (!app.context.keys.has(key)) {
            console.error('FileFilter: Unknown key: ' + key);
            cb(null, false);
            return;
        }
        if (
            !allowedTypes.includes(file.mimetype) ||
            !allowedExtensions.includes(
                extname(file.originalname.toLowerCase()).substr(1)
            )
        ) {
            console.error('FileFilter: File is of an invalid type ', file);
            cb(null, false);
            return;
        }
        cb(null, true);
    },
});

/**
 * Upload a file to the uploads folder
 *
 * @param ctx the router
 */
export const convertToCorrectType = async (ctx: Context) => {
    const key = ctx.request.body.key.toUpperCase();

    // @ts-ignore
    const requestFile = ctx.request.file;

    if (requestFile) {
        console.log('Uploaded file:', requestFile);
    }

    if (!ctx.keys.has(key)) {
        flash(ctx, {
            message: 'Unknown key ' + key,
            success: false,
        });
        ctx.redirect('back', '/');
        if (requestFile) {
            unlink(requestFile.path, (err) => {
                if (err) console.error(err);
                else console.log('Removed file', requestFile.path);
            });
        }
        return;
    }

    if (!requestFile || requestFile.size === 0) {
        flash(ctx, {
            message: 'Invalid file submitted',
            success: false,
            key: key,
        });
        ctx.redirect('back', '/');
        if (requestFile) {
            unlink(requestFile.path, (err) => {
                if (err) console.error(err);
                else console.log('Removed file', requestFile.path);
            });
        }
        return;
    }

    const mimetype = requestFile.mimetype;

    const type = await filteType.fromFile(requestFile.path);

    if (!type || !allowedTypes.includes(type.mime)) {
        flash(ctx, {
            message:
                'Uploaded file is of an invalid type: ' +
                requestFile.originalname +
                ' (' +
                (type ? type.mime : 'unknown mimetype') +
                ')',
            success: false,
            key: key,
        });
        ctx.redirect('back', '/');
        unlink(requestFile.path, (err) => {
            if (err) console.error(err);
            else console.log('Removed file', requestFile.path);
        });
        return;
    }

    const storedInformation = (<Map<string, StoredInformation>> ctx.keys).get(key);
    expireKey(key);

    const convertionData = await convertBook(
        requestFile.path,
        ctx.request.body.kepubify,
        requestFile.originalname,
        mimetype,
        storedInformation.agent
    );

    if (storedInformation.file && storedInformation.file.path) {
        await new Promise((resolve, reject) =>
            unlink(storedInformation.file.path, (err) => {
                if (err) return reject(err);
                else
                    console.log(
                        'Removed previously uploaded file',
                        storedInformation.file.path
                    );
                resolve(true);
            })
        );
    }

    storedInformation.file = {
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
