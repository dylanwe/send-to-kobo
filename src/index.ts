import { existsSync, rm } from 'fs';
import Koa from 'koa';
import render from 'koa-ejs';
import logger from 'koa-logger';
import serve from 'koa-static';
import mkdirp from 'mkdirp';
import path from 'path';
import router from './router';

const PORT = 3000;
export const app = new Koa();
app.context.keys = new Map();
app.use(serve('./src/static'));
app.use(logger());
app.use(router.routes());
app.use(router.allowedMethods());

// config ejs view engine
render(app, {
    root: path.join(path.resolve(), '/src/views'),
    layout: false,
    viewExt: 'ejs',
    cache: false,
});

// 404 page
app.use(async (ctx, next) => {
    try {
        await next();

        if (ctx.status === 404) ctx.throw(404);
    } catch (err) {
        console.error(err);
        ctx.status = err.status || 500;
        await ctx.render('404');
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

// start server
app.listen(process.env.PORT || PORT);
console.log(
    `⚡️ [Server] - server is listening on port http://localhost:${process.env.PORT || PORT}`
);
