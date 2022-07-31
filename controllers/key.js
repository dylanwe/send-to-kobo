import { app } from "./../index.js";
import { unlink } from 'fs';

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
 */
export const removeKey = (key) => {
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
export const expireKey = (key) => {
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
