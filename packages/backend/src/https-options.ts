import {replaceExtension} from '@augment-vir/common';
import {readFile} from 'node:fs/promises';

/**
 * Set in the shell that runs the backend. Browsers only allow the WebCodecs video decoder on HTTPS
 * pages. The key is expected next to the cert with a `.key` extension, the same as the virmator
 * frontend dev server.
 */
const httpsCertPath = process.env.HTTPS_CERT_PATH || undefined;

export const protocol = httpsCertPath ? 'https' : 'http';

export async function readHttpsOptions() {
    if (!httpsCertPath) {
        return undefined;
    }

    return {
        cert: await readFile(httpsCertPath),
        key: await readFile(
            replaceExtension({
                path: httpsCertPath,
                newExtension: '.key',
            }),
        ),
    };
}
