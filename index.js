import Koa from 'koa';
import serve from "koa-static";
import Router from '@koa/router';
import multer from '@koa/multer';
import logger from 'koa-logger';
import sendfile from 'koa-sendfile';
import mkdirp from 'mkdirp';
import { unlink, existsSync, rm } from 'fs';
import { spawn } from 'child_process';
import { extname, basename, dirname } from 'path';
import filteType from 'file-type';

const app = new Koa();
const router = new Router();
app.context.keys = new Map();
app.use(serve('./static'))
app.use(logger());
app.use(router.routes());
app.use(router.allowedMethods());

const port = 3000;
const expireDelay = 30; // 30 seconds
const maxExpireDuration = 1 * 60 * 60; // 1 hour
const maxFileSize = 1024 * 1024 * 800; // 800 MB

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
const allowedExtensions = ['epub', 'mobi', 'pdf', 'cbz', 'cbr', 'html', 'txt'];



/**
 * Generate a new random key made up of 4 random charachters
 * 
 * @returns A random string of 4 charachters
 */
const generateRandomKey = () => {
    const keyLength = 4;
    const keyChars = '3469ACEGHLMNPRTY';
    let randomString = '';

    for (let i = 0; i < keyLength; i++) {
        const randomNumber = Math.floor(Math.random() * keyChars.length);
        randomString += keyChars.charAt(randomNumber);
    }

    return randomString;
};

const removeKey = (key) => {
    console.log('Removing expired key', key);
    const info = app.context.keys.get(key);
    if (info) {
        clearTimeout(app.context.keys.get(key).timer);
        if (info.file) {
            console.log('Deleting file', info.file.path);
            unlink(info.file.path, (err) => {
                if (err) console.error(err);
            });
            info.file = null;
        }
        app.context.keys.delete(key);
    } else {
        console.log('Tried to remove non-existing key', key);
    }
};

/**
 * Expire the key
 * 
 * @param {string} key the session key of 4 charachters
 * @returns the expiration timer
 */
const expireKey = (key) => {
    console.log('key', key, 'will expire in', expireDelay, 'seconds');
    const info = app.context.keys.get(key);
    const timer = setTimeout(removeKey, expireDelay * 1000, key);

    if (info) {
        clearTimeout(info.timer);
        info.timer = timer;
        info.alive = new Date();
    }

    return timer;
};

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
 */
const upload = multer({
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
    fileFilter: (req, file, cb) => {
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

// Generate a new key
router.post('/generate', async (ctx) => {
    const agent = ctx.get('user-agent');

    let key = null;
    let attempts = 0;
    console.log('There are currently', ctx.keys.size, 'key(s) in use.');
    console.log('Generating unique key...', ctx.ip, agent);
    do {
        key = generateRandomKey();
        if (attempts > ctx.keys.size) {
            console.error(
                "Can't generate more keys, map is full.",
                attempts,
                ctx.keys.size
            );
            ctx.body = 'error';
            return;
        }
        attempts++;
    } while (ctx.keys.has(key));

    console.log('Generated key ' + key + ', ' + attempts + ' attempt(s)');

    const info = {
        created: new Date(),
        agent: agent,
        file: null,
    };
    ctx.keys.set(key, info);
    expireKey(key);
    setTimeout(() => {
        // remove if it is the same object
        if (ctx.keys.get(key) === info) removeKey(key);
    }, maxExpireDuration * 1000);

    ctx.body = key;
});

// Download a file with the given key
router.get('/download/:key', async (ctx) => {
    const key = ctx.params.key.toUpperCase();
    const info = ctx.keys.get(key);
    if (!info || !info.file) {
        return;
    }
    if (info.agent !== ctx.get('user-agent')) {
        console.error(
            'User Agent doesnt match: ' +
                info.agent +
                ' VS ' +
                ctx.get('user-agent')
        );
        return;
    }
    expireKey(key);
    console.log('Sending file', info.file.path);
    await sendfile(ctx, info.file.path);
    ctx.attachment(info.file.name);
});

// Upload a file to the uploads folder
router.post('/upload', upload.single('file'), async (ctx) => {
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
    expireKey(key);

    let data = null;
    let filename = ctx.request.file.originalname;
    let conversion = null;

    if (mimetype === TYPE_EPUB && info.agent.includes('Kindle')) {
        // convert to .mobi
        conversion = 'kindlegen';
        const outname = ctx.request.file.path.replace(/\.epub$/i, '.mobi');
        filename = filename
            .replace(/\.kepub\.epub$/i, '.epub')
            .replace(/\.epub$/i, '.mobi');

        data = await new Promise((resolve, reject) => {
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
    } else if (
        mimetype === TYPE_EPUB &&
        info.agent.includes('Kobo') &&
        ctx.request.body.kepubify
    ) {
        // convert to Kobo EPUB
        conversion = 'kepubify';
        const outname = ctx.request.file.path.replace(
            /\.epub$/i,
            '.kepub.epub'
        );
        filename = filename
            .replace(/\.kepub\.epub$/i, '.epub')
            .replace(/\.epub$/i, '.kepub.epub');

        data = await new Promise((resolve, reject) => {
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
    } else {
        // No conversion
        data = ctx.request.file.path;
    }

    expireKey(key);
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
});

// delete a file with the given key
router.delete('/file/:key', async (ctx) => {
    const key = ctx.params.key.toUpperCase();
    const info = ctx.keys.get(key);
    if (!info) {
        ctx.throw(400, 'Unknown key: ' + key);
    }
    info.file = null;
    ctx.body = 'ok';
});

// Get the status of the key
router.get('/status/:key', async (ctx) => {
    const key = ctx.params.key.toUpperCase();
    const info = ctx.keys.get(key);
    if (!info) {
        ctx.body = { error: 'Unknown key' };
        return;
    }
    if (info.agent !== ctx.get('user-agent')) {
        // don't send this error to client
        console.error(
            'User Agent doesnt match: ' +
                info.agent +
                ' VS ' +
                ctx.get('user-agent')
        );
        return;
    }
    expireKey(key);
    ctx.body = {
        alive: info.alive,
        file: info.file
            ? {
                  name: info.file.name,
                  // size: info.file.size
              }
            : null,
    };
});

// Render the download page
router.get('/receive', async (ctx) => {
    await sendfile(ctx, 'views/download.html');
});

// Render the homepage depending on what device the user is using
router.get('/', async (ctx) => {
    const agent = ctx.get('user-agent');
    console.log(ctx.ip, agent);
    await sendfile(
        ctx,
        agent.includes('Kobo') || agent.includes('Kindle')
            ? 'views/download.html'
            : 'views/upload.html'
    );
});

/**
 * Start the app
 */
const startApp = () => {
    app.listen(port);
    console.log(`server is listening on port http://localhost:${port}`);
};

// Check if upload folder exists
if (existsSync('./uploads')) {
    rm('uploads', { recursive: true }, (err) => {
        if (err) throw err;
        mkdirp('uploads').then(() => {
            startApp();
        });
    });
} else {
    mkdirp('uploads').then(() => {
        startApp();
    });
}
