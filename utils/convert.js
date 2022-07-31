import { spawn } from 'child_process';
import { unlink } from 'fs';
import { basename, dirname } from 'path';

/**
 * Convert a book to another format
 * 
 * @param {string} conversion what conversion command to run
 * @param {string} pathOfFile the path of the file
 * @param {string} filename the name of the file
 * @returns data of conversion
 */
const convertWith = async (conversion, pathOfFile, filename) => {
    const returnValues = {
        conversion,
        filename,
        data: null,
    };

    const outname = pathOfFile.replace(/\.epub$/i, `${(conversion === 'kindlegen') ? '.mobi' : '.kepub.epub'}` );

    // commands to run for converters
    const conversionCommands = {
        kindlegen: {
            name: 'kindlegen',
            commands: [
                basename(pathOfFile),
                '-dont_append_source',
                '-c1',
                '-o',
                basename(outname),
            ],
        },
        kepubify: {
            name: 'kepubify',
            commands: [
                '-v',
                '-u',
                '-o',
                basename(outname),
                basename(pathOfFile),
            ],
        },
    }
    
    returnValues.filename = filename
        .replace(/\.kepub\.epub$/i, '.epub')
        .replace(/\.epub$/i, `${(conversion === 'kindlegen') ? '.mobi' : '.kepub.epub'}`);

    returnValues.data = await new Promise((resolve, reject) => {
        // convert book
        let converter;
        try {
            converter = spawn(
                conversion,
                (conversion === 'kindlegen') ? conversionCommands.kindlegen.commands : conversionCommands.kepubify.commands,
                {
                    stdio: 'inherit',
                    cwd: dirname(pathOfFile),
                }
            );
        }
        catch (error) {
            console.error('Conversion didn\'t work check if cli tools for conversion are installed');
        }
        
        // close converter
        converter.once('close', (code) => {
            unlink(pathOfFile, (err) => {
                if (err) console.error(err);
                else console.log('Removed file', pathOfFile);
            });
            
            // replace epub with mobi8 in name if kindlegen
            if (conversion === 'kindlegen') {
                const mobiName = pathOfFile.replace(/\.epub$/i, '.mobi8');
                unlink(
                    mobiName,
                    (err) => {
                        if (err) console.error(err);
                        else console.log(`Removed file: \n ${mobiName}`);
                    }
                );
            }
            
            // show error code if there is an error
            if (code !== 0) {
                reject(`${conversion} error code ${code}`);
                return;
            }
    
            resolve(outname);
        });
    });

    return returnValues;
}

/**
 * Convert a book to a different type
 * 
 * @param {string} pathOfFile the path of the book to convert
 * @param {boolean} kepubify if the book should be kepubified
 * @param {string} originalFileName the original name of the file
 * @param {*} mimetype the type of the book
 * @param {*} agent what device the user is using
 */
export const convertBook = async (pathOfFile, kepubify, originalFileName, mimetype, agent) => {
    const TYPE_EPUB = 'application/epub+zip';

    // the data after convertion
    let convertionData = null;

    if (mimetype === TYPE_EPUB && agent.includes('Kindle')) {
        // convert to .mobi
        convertionData = await convertWith('kindlegen', pathOfFile, originalFileName);
    } else if (
        mimetype === TYPE_EPUB &&
        agent.includes('Kobo') &&
        kepubify
    ) {
        // convert to Kobo EPUB
        convertionData = await convertWith('kepubify', pathOfFile, originalFileName);
    } else {
        // No conversion
        convertionData.data = pathOfFile;
    }

    return convertionData;
};
