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
                port: 5391,
                /** Fail instead of silently moving to another port, so the page's URL never changes. */
                strictPort: true,
                proxy: {
                    [streamEndpoint.path]: {
                        target: `${backendProtocol}://localhost:${backendPort}`,
                        /** The backend's certificate may be self-signed. */
                        secure: false,
                    },
                },
            },
            /**
             * `vite preview` serves the built frontend, which uses far less memory than the dev
             * server.
             */
            preview: {
                port: 5391,
                strictPort: true,
            },
        };
    },
);
