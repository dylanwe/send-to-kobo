import filteType from 'file-type';
import multer from '@koa/multer';
import { extname } from 'path';
import { unlink } from 'fs';
import { app } from '../index';
import { expireKey } from './key';
import { convertBook } from '../utils/convert';
import { Request } from 'koa';

const allowedExtensions = ['epub', 'mobi', 'pdf', 'cbz', 'cbr', 'html', 'txt'];
const maxFileSize = 1024 * 1024 * 800; // 800 MB
const allowedTypes = [
    'application/epub+zip',
    'application/x-mobipocket-ebook',
    'application/pdf',
    'application/vnd.comicbook+zip',
    'application/vnd.comicbook-rar',
    'text/html',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
];

/**
 * Upload a file to the uploads folder
 */
export const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads');
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.floor(
                Math.random() * 1e9
            )}`;
            cb(
                null,
                file.fieldname +
                    '-' +
                    uniqueSuffix +
                    extname(file.originalname).toLowerCase()
            );
        },
    }),
    limits: {
        fileSize: maxFileSize,
        files: 1,
    },
    fileFilter: (req: Request, file: any, cb: any) => {
        console.log('Incoming file:', file);
        const key = req.body.key.toUpperCase();
        if (!app.context.keys.has(key)) {
            console.error(`FileFilter: Unknown key: ${key}`);
            cb(null, false);
            return;
        }
        if (
            !allowedTypes.includes(file.mimetype) ||
            !allowedExtensions.includes(
                extname(file.originalname.toLowerCase()).substr(1)
            )
        ) {
            console.error(`FileFilter: File is of an invalid type ${file}`);
            cb(null, false);
            return;
        }
        cb(null, true);
    },
});

/**
 * Remove a file with the given path
 *
 * @param filePath the path of the file to remove
 */
export const removeFile = (filePath: string) => {
    unlink(filePath, (err) => {
        if (err) console.error(err);
        else console.log('Removed file', filePath);
    });
};

/**
 * Upload a file to the uploads folder
 *
 * @param key the key of the session
 * @param requestFile the file to upload
 * @param storedInformation the information in the cookie of this key
 * @returns A message giving the status of the upload
 */
export const convertToCorrectType = async (
    key: string,
    requestFile: any,
    storedInformation: StoredInformation
): Promise<FlashMessage> => {
    const mimetype = requestFile.mimetype;
    const type = await filteType.fromFile(requestFile.path);

    if (requestFile) {
        console.log('Uploaded file:', requestFile);
    }

    if (!requestFile || requestFile.size === 0) {
        if (requestFile) {
            removeFile(requestFile.path);
        }
        return {
            message: 'Invalid file submitted',
            success: false,
            key: key,
        };
    }

    if (!type || !allowedTypes.includes(type.mime)) {
        removeFile(requestFile.path);
        return {
            message: `Uploaded file is of an invalid type: ${
                requestFile.originalname
            } (${type ? type.mime : 'unknown mimetype'})`,
            success: false,
            key: key,
        };
    }

    expireKey(key);

    const convertionData = await convertBook(
        requestFile.path,
        requestFile.originalname,
        mimetype,
        storedInformation.agent
    );

    if (storedInformation.file && storedInformation.file.path) {
        await new Promise((resolve, reject) =>
            unlink(storedInformation.file.path, (err) => {
                if (err) return reject(err);
                else
                    console.log(
                        'Removed previously uploaded file',
                        storedInformation.file.path
                    );
                resolve(true);
            })
        );
    }

    storedInformation.file = {
        name: convertionData.filename,
        path: convertionData.data,
        uploaded: new Date(),
    };

    // send message if upload was successful
    return {
        message: 'Upload successful!',
        success: true,
        key: key,
    };
};
