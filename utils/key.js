const expireDelay = 30; // 30 seconds delay before a key expires

/**
 * Generate a new random key made up of 4 random charachters
 *
 * @returns A random string of 4 charachters
 */
export const generateRandomKey = () => {
    const keyLength = 4;
    const keyChars = '3469ACEGHLMNPRTY';
    let randomString = '';

    for (let i = 0; i < keyLength; i++) {
        const randomNumber = Math.floor(Math.random() * keyChars.length);
        randomString += keyChars.charAt(randomNumber);
    }

    return randomString;
};

/**
 * Remove a key
 *
 * @param {string} key the key to remove
 * @param {*} appContext the context of the Koa app
 */
export const removeKey = (key, appContext) => {
    console.log('Removing expired key', key);
    const info = appContext.keys.get(key);
    if (info) {
        clearTimeout(appContext.keys.get(key).timer);
        if (info.file) {
            console.log('Deleting file', info.file.path);
            unlink(info.file.path, (err) => {
                if (err) console.error(err);
            });
            info.file = null;
        }
        appContext.keys.delete(key);
    } else {
        console.log('Tried to remove non-existing key', key);
    }
};

/**
 * Expire the key
 *
 * @param {string} key the session key of 4 charachters
 * @param {*} appContext the context of the Koa app
 * @returns the expiration timer
 */
export const expireKey = (key, appContext) => {
    console.log('key', key, 'will expire in', expireDelay, 'seconds');
    const info = appContext.keys.get(key);
    const timer = setTimeout(removeKey, expireDelay * 1000, key);

    if (info) {
        clearTimeout(info.timer);
        info.timer = timer;
        info.alive = new Date();
    }

    return timer;
};
