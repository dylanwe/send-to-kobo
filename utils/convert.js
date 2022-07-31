import { spawn } from 'child_process';
import { unlink } from 'fs';
import { basename, dirname } from 'path';

/**
 * Convert a book to another format
 * 
 * @param {string} conversion what conversion command to run
 * @param {*} ctx router
 * @param {string} filename the name of the file
 * @returns data of conversion
 */
const convertWith = async (conversion, ctx, filename) => {
    const returnValues = {
        conversion,
        filename,
        data: null,
    };

    const outname = ctx.request.file.path.replace(/\.epub$/i, `${(conversion === 'kindlegen') ? '.mobi' : '.kepub.epub'}` );

    // commands to run for converters
    const conversionCommands = {
        kindlegen: {
            name: 'kindlegen',
            commands: [
                basename(ctx.request.file.path),
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
                basename(ctx.request.file.path),
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
                    cwd: dirname(ctx.request.file.path),
                }
            );
        }
        catch (error) {
            console.error('Conversion didn\'t work check if cli tools for conversion are installed');
        }
        
        // close converter
        converter.once('close', (code) => {
            unlink(ctx.request.file.path, (err) => {
                if (err) console.error(err);
                else console.log('Removed file', ctx.request.file.path);
            });
            
            // replace epub with mobi8 in name if kindlegen
            if (conversion === 'kindlegen') {
                const mobiName = ctx.request.file.path.replace(/\.epub$/i, '.mobi8');
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
 * @param {*} ctx router
 * @param {*} mimetype file type detector
 * @param {*} info info of the book
 * @returns the data after the convertion
 */
export const convertBook = async (ctx, mimetype, info) => {
    const TYPE_EPUB = 'application/epub+zip';

    // the data after convertion
    let convertionData = {
        filename: ctx.request.file.originalname,
    };

    if (mimetype === TYPE_EPUB && info.agent.includes('Kindle')) {
        // convert to .mobi
        convertionData = await convertWith('kindlegen', ctx, convertionData.filename);
    } else if (
        mimetype === TYPE_EPUB &&
        info.agent.includes('Kobo') &&
        ctx.request.body.kepubify
    ) {
        // convert to Kobo EPUB
        convertionData = await convertWith('kepubify', ctx, convertionData.filename);
    } else {
        // No conversion
        convertionData.data = ctx.request.file.path;
    }

    return convertionData;
};
