import {createStreamFrameHeader, streamEndpoint} from '@pi-camera-stream/common';
import {HttpMethod, HttpStatus} from '@rest-vir/api';
import {backendImplementor} from '../backend-implementor.js';

const maxBufferedBytes = 1024 * 1024;

export const streamEndpointImplementation = backendImplementor.implementEndpoint(streamEndpoint, {
    [HttpMethod.Get]({response, context}) {
        response.hijack();
        response.raw.writeHead(HttpStatus.Ok, {
            'content-type': 'application/octet-stream',
            'cache-control': 'no-cache, no-store',
            'x-no-compression': 'true',
        });

        /** Delta frames can't be decoded without every frame since the last keyframe. */
        const viewer = {
            isWaitingForKeyframe: true,
        };

        const unsubscribe = context.camera.subscribe({
            onAccessUnit(accessUnit) {
                /**
                 * Drop frames for slow viewers instead of buffering an ever-growing backlog. This
                 * doesn't use `writableNeedDrain` because a single keyframe can exceed the default
                 * high water mark, which would drop the rest of every keyframe interval.
                 */
                if (response.raw.writableLength > maxBufferedBytes) {
                    viewer.isWaitingForKeyframe = true;
                    return;
                } else if (viewer.isWaitingForKeyframe && !accessUnit.isKeyframe) {
                    return;
                }

                viewer.isWaitingForKeyframe = false;
                response.raw.write(createStreamFrameHeader(accessUnit));
                response.raw.write(accessUnit.data);
            },
            onEnd() {
                response.raw.end();
            },
        });

        response.raw.on('close', unsubscribe);

        return {
            responseHandled: true,
        };
    },
});
