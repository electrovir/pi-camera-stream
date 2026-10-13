import {log} from '@augment-vir/common';
import {backendPort, cameraApi} from '@pi-camera-stream/common';
import {implementApi, startApiServer} from '@rest-vir/host';
import {type BackendContext} from './backend-implementor.js';
import {H264Camera} from './camera/h264-camera.js';
import {streamEndpointImplementation} from './endpoints/stream.endpoint.implementation.js';
import {protocol, readHttpsOptions} from './https-options.js';

const camera = new H264Camera({
    width: 1280,
    height: 720,
    framerate: 30,
});

await startApiServer(
    implementApi<BackendContext>()(cameraApi, {
        createHostContext() {
            return {
                context: {
                    camera,
                },
            };
        },
        endpoints: [
            streamEndpointImplementation,
        ],
    }),
    {
        port: backendPort,
        lockPort: true,
        host: '0.0.0.0',
        externalOrigin: `${protocol}://localhost:${backendPort}`,
        https: await readHttpsOptions(),
        /** Each worker would spawn its own camera process, and only one can hold the camera. */
        workerCount: 1,
    },
);

log.success(`Camera stream backend running at ${protocol}://localhost:${backendPort}`);
