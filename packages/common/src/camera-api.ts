import {defineApi, defineEndpoint, HttpMethod, HttpStatus} from '@rest-vir/api';

/** The port the backend listens on. The frontend dev server proxies the stream to it. */
export const backendPort = 3000;

/**
 * A never-ending binary stream of H.264 frames from the camera, each prefixed with a header from
 * `createStreamFrameHeader`. The first frame is always a keyframe.
 */
export const streamEndpoint = defineEndpoint({
    path: '/stream',
    requests: {
        [HttpMethod.Get]: {
            responses: {
                [HttpStatus.Ok]: {
                    responseData: undefined,
                },
            },
        },
    },
});

export const cameraApi = defineApi({
    apiName: 'pi-camera-stream',
    endpoints: [
        streamEndpoint,
    ],
});
