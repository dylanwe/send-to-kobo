import { Context } from 'koa';

/**
 * Send a flash message
 *
 * @param ctx context of the user
 * @param data the data to send in the message
 */
const flash = (ctx: Context, data: FlashMessage) => {
    ctx.cookies.set('flash', encodeURIComponent(JSON.stringify(data)), {
        overwrite: true,
        httpOnly: false,
        sameSite: "strict",
    });
};

export default flash;