import { app } from "../index.js";
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
 * @param key the key to remove
 */
export const removeKey = (key: string) => {
    console.log('Removing expired key', key);
    const storedInformation = (<Map<string, StoredInformation>> app.context.keys).get(key);
    if (storedInformation) {
        clearTimeout(storedInformation.timer);
        if (storedInformation.file) {
            console.log(`Deleting file ${storedInformation.file.path}`);
            unlink(storedInformation.file.path, (err) => {
                if (err) console.error(err);
            });
            storedInformation.file = null;
        }
        app.context.keys.delete(key);
        return;
    }

    console.log(`Tried to remove non-existing key ${key}`);
};

/**
 * Expire the key
 *
 * @param key the session key of 4 charachters
 * @returns the expiration timer
 */
export const expireKey = (key: string) => {
    console.log(`key ${key} will expire in ${expireDelay} seconds`);
    const storedInformation = (<Map<string, StoredInformation>> app.context.keys).get(key);
    const timer = setTimeout(removeKey, expireDelay * 1000, key);

    if (storedInformation) {
        clearTimeout(storedInformation.timer);
        storedInformation.timer = timer;
        storedInformation.alive = new Date();
    }

    return timer;
};
