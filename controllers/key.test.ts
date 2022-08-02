import { generateRandomKey } from './key';

describe('key', () => {
    it('Should generate a random string of 4 charachters from the allowed charachter list', () => {
        const keys = <Map<string, StoredInformation>>new Map();
        const keyRegex = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;

        expect(generateRandomKey(keys)).toMatch(keyRegex);
    });
});
