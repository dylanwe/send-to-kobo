import { Context } from 'koa';
import Router from 'koa-router';
import sendfile from 'koa-sendfile';
import { expireKey, generateRandomKey, removeKey } from './controllers/key.js';
import {
    convertToCorrectType,
    upload,
    removeFile,
} from './controllers/upload.js';

const router = new Router();

/**
 * Send a flash message
 *
 * @param ctx context of the user
 * @param data the data to send in the message
 */
const flash = (ctx: any, data: FlashMessage) => {
    ctx.cookies.set('flash', encodeURIComponent(JSON.stringify(data)), {
        overwrite: true,
        httpOnly: false,
    });
};

// Render the homepage depending on what device the user is using
router.get('/', async (ctx) => {
    const agent = ctx.get('user-agent');

    if (agent.includes('Kobo') || agent.includes('Kindle')) {
        await ctx.render('download');
        return;
    }

    await ctx.render('upload');
});

// Render the download page
router.get('/receive', async (ctx: Context) => {
    await ctx.render('download');
});

// Download a file with the given key
router.get('/download/:key', async (ctx: Context) => {
    const key = (<string>ctx.params.key).toUpperCase();
    const storedInformation = (<Map<string, StoredInformation>>ctx.keys).get(
        key
    );

    if (!storedInformation || !storedInformation.file) return;

    if (storedInformation.agent !== ctx.get('user-agent')) {
        console.error(
            `User Agent doesnt match: ${storedInformation.agent} VS ${ctx.get(
                'user-agent'
            )}`
        );
        return;
    }

    expireKey(key);
    console.log('Sending file', storedInformation.file.path);
    await sendfile(ctx, storedInformation.file.path);
    ctx.attachment(storedInformation.file.name);
});

// Get the status of the key
router.get('/status/:key', async (ctx: Context) => {
    const key = (<string>ctx.params.key).toUpperCase();
    const storedInformation = (<Map<string, StoredInformation>>ctx.keys).get(
        key
    );
    if (!storedInformation) {
        ctx.body = { error: 'Unknown key' };
        return;
    }
    if (storedInformation.agent !== ctx.get('user-agent')) {
        // don't send this error to client
        console.error(
            `User Agent doesnt match: ${storedInformation.agent} VS ${ctx.get(
                'user-agent'
            )}`
        );
        return;
    }

    expireKey(key);
    ctx.body = {
        alive: storedInformation.alive,
        file: storedInformation.file
            ? { name: storedInformation.file.name }
            : null,
    };
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

// Upload a file to the uploads folder
router.post('/upload', upload.single('file'), async (ctx: Context) => {
    // @ts-ignore
    const file = ctx.request.file;
    const key = (<string> ctx.request.body.key).toUpperCase();
    const kepubify = <boolean> ctx.request.body.kepubify;

    // errors
    if (!ctx.keys.has(key)) {
        flash(ctx, {
            message: `Unknown key ${key}`,
            success: false,
        });
        ctx.redirect('back', '/');

        if (file) {
            removeFile(file.path);
        }
        return;
    }

    const storedInformation = (<Map<string, StoredInformation>>ctx.keys).get(
        key
    );

    const convertionMessage = await convertToCorrectType(
        key,
        file,
        kepubify,
        storedInformation
    );

    flash(ctx, convertionMessage);
    ctx.redirect('back', '/');
});

// delete a file with the given key
router.delete('/file/:key', async (ctx: Context) => {
    const key = (<string>ctx.params.key).toUpperCase();
    const storedInformation = (<Map<string, StoredInformation>>ctx.keys).get(
        key
    );

    if (!storedInformation) ctx.throw(400, `Unknown key: ${key}`);

    storedInformation.file = null;
    ctx.body = 'ok';
});

export default router;
