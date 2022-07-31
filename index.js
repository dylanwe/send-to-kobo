import multer from '@koa/multer';
import Router from '@koa/router';
import { existsSync, rm } from 'fs';
import Koa from 'koa';
import render from "koa-ejs";
import logger from 'koa-logger';
import sendfile from 'koa-sendfile';
import serve from 'koa-static';
import mkdirp from 'mkdirp';
import path, { extname } from 'path';
import { expireKey, generateRandomKey, removeKey } from './controllers/key.js';
import { uploadToFolder } from './controllers/upload.js';

export const app = new Koa();
const router = new Router();
app.context.keys = new Map();
app.use(serve('./static'));
app.use(logger());
app.use(router.routes());
app.use(router.allowedMethods());

// config ejs view engine
render(app, {
    root: path.join(path.resolve(), '/views'),
    layout: false,
    viewExt: 'ejs',
    cache: false,
});

const port = 3000;
const maxExpireDuration = 1 * 60 * 60; // 1 hour
const maxFileSize = 1024 * 1024 * 800; // 800 MB

const allowedExtensions = ['epub', 'mobi', 'pdf', 'cbz', 'cbr', 'html', 'txt'];

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
    expireKey(key, app.context);
    setTimeout(() => {
        // remove if it is the same object
        if (ctx.keys.get(key) === info) removeKey(key, app.context);
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
    expireKey(key, app.context);
    console.log('Sending file', info.file.path);
    await sendfile(ctx, info.file.path);
    ctx.attachment(info.file.name);
});

// Upload a file to the uploads folder
router.post('/upload', upload.single('file'), async (ctx) => {
    await uploadToFolder(ctx);
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
    expireKey(key, app.context);
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

    if (agent.includes('Kobo') || agent.includes('Kindle')) {
        await ctx.render('download');
    } else {
        await ctx.render('upload');
    }
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
