import Koa, { Context } from 'koa';
import Router from 'koa-router';
import { existsSync, rm } from 'fs';
import render from 'koa-ejs';
import logger from 'koa-logger';
import sendfile from 'koa-sendfile';
import serve from 'koa-static';
import mkdirp from 'mkdirp';
import path from 'path';
import { expireKey, generateRandomKey, removeKey } from './controllers/key.js';
import { upload, convertToCorrectType } from './controllers/upload.js';

const port = 3000;
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

// Generate a new key
router.post('/generate', async (ctx: Context) => {
    const agent = ctx.get('user-agent');
    const maxExpireDuration = 1000 * 60 * 60; // 1 hour

    let key = '';
    let attempts = 0;

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

    console.log(`Generated key ${key}, ${attempts} attempt(s)`);

    const informationOfKey: StoredInformation = {
        created: new Date(),
        agent: agent,
        file: null,
    };
    ctx.keys.set(key, informationOfKey);
    expireKey(key);
    setTimeout(() => {
        // remove if it is the same object
        if (ctx.keys.get(key) === informationOfKey) removeKey(key);
    }, maxExpireDuration);

    ctx.body = key;
});

// Download a file with the given key
router.get('/download/:key', async (ctx: Context) => {
    const key = (<string> ctx.params.key).toUpperCase();
    const storedInformation = (<Map<string, StoredInformation>> ctx.keys).get(key);
    if (!storedInformation || !storedInformation.file) {
        return;
    }
    if (storedInformation.agent !== ctx.get('user-agent')) {
        console.error(
            `User Agent doesnt match: ${storedInformation.agent} VS ${ctx.get('user-agent')}`
        );
        return;
    }
    expireKey(key);
    console.log('Sending file', storedInformation.file.path);
    await sendfile(ctx, storedInformation.file.path);
    ctx.attachment(storedInformation.file.name);
});

// Upload a file to the uploads folder
router.post('/upload', upload.single('file'), async (ctx: Context) => {
    await convertToCorrectType(ctx);
});

// delete a file with the given key
router.delete('/file/:key', async (ctx: Context) => {
    const key = (<string> ctx.params.key).toUpperCase();
    const storedInformation = (<Map<string, StoredInformation>> ctx.keys).get(key);

    if (!storedInformation) {
        ctx.throw(400, 'Unknown key: ' + key);
    }

    storedInformation.file = null;
    ctx.body = 'ok';
});

// Get the status of the key
router.get('/status/:key', async (ctx: Context) => {
    const key =  (<string> ctx.params.key).toUpperCase();
    const storedInformation = (<Map<string, StoredInformation>> ctx.keys).get(key);
    if (!storedInformation) {
        ctx.body = { error: 'Unknown key' };
        return;
    }
    if (storedInformation.agent !== ctx.get('user-agent')) {
        // don't send this error to client
        console.error(
            'User Agent doesnt match: ' +
                storedInformation.agent +
                ' VS ' +
                ctx.get('user-agent')
        );
        return;
    }
    expireKey(key);
    ctx.body = {
        alive: storedInformation.alive,
        file: storedInformation.file ? { name: storedInformation.file.name } : null,
    };
});

// Render the download page
router.get('/receive', async (ctx: Context) => {
    await ctx.render('download');
});

// Render the homepage depending on what device the user is using
router.get('/', async (ctx) => {
    const agent = ctx.get('user-agent');

    if (agent.includes('Kobo') || agent.includes('Kindle')) {
        await ctx.render('download');
    } else {
        await ctx.render('upload');
    }
});

// remove upload folder
if (existsSync('./uploads')) {
    await new Promise((resolve) =>
        rm('uploads', { recursive: true }, (err) => {
            if (err) throw err;
            resolve(true);
        })
    );
}

await mkdirp('uploads');

app.listen(port);
console.log(
    `⚡️ [Server] - server is listening on port http://localhost:${port}`
);
