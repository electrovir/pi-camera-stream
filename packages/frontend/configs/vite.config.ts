import {backendPort, streamEndpoint} from '@pi-camera-stream/common';
import {defineConfig} from '@virmator/frontend/configs/vite.config.base.js';
import {resolve} from 'node:path';

/** The backend serves HTTPS when this is set. See `packages/backend/src/https-options.ts`. */
const backendProtocol = process.env.HTTPS_CERT_PATH ? 'https' : 'http';

export default defineConfig(
    {
        forGitHubPages: false,
        packageDirPath: resolve(import.meta.dirname, '..'),
    },
    (baseConfig) => {
        return {
            ...baseConfig,
            server: {
                ...baseConfig.server,
                proxy: {
                    [streamEndpoint.path]: {
                        target: `${backendProtocol}://localhost:${backendPort}`,
                        /** The backend's certificate may be self-signed. */
                        secure: false,
                    },
                },
            },
        };
    },
);
