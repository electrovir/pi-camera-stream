// cspell:word unconfigured

import {assertWrap} from '@augment-vir/assert';
import {wait} from '@augment-vir/common';
import {
    extractAvcCodecString,
    splitStreamFrames,
    streamEndpoint,
    type AccessUnit,
} from '@pi-camera-stream/common';
import {convertDuration, type AnyDuration} from 'date-vir';

/** Long enough to cover the camera starting up and the wait for the first keyframe. */
const stalledStreamTimeout: AnyDuration = {
    seconds: 5,
};

/**
 * Plays the backend's H.264 stream into the given canvas until `abortSignal` fires, reconnecting
 * whenever the stream drops. Requires an HTTPS page because browsers only expose `VideoDecoder` in
 * secure contexts.
 */
export async function playH264Stream({
    canvas,
    abortSignal,
    readRotation,
}: Readonly<{
    canvas: HTMLCanvasElement;
    abortSignal: AbortSignal;
    /** Clockwise degrees. Read for every frame, so rotation changes apply without reconnecting. */
    readRotation: () => number;
}>) {
    const context = assertWrap.isDefined(canvas.getContext('2d'));

    while (!abortSignal.aborted) {
        try {
            await playUntilDisconnected({
                canvas,
                context,
                abortSignal,
                readRotation,
            });
        } catch {
            /** Network and decoder errors are handled by reconnecting below. */
        }

        await wait({
            seconds: 1,
        });
    }
}

async function playUntilDisconnected({
    canvas,
    context,
    abortSignal,
    readRotation,
}: Readonly<{
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    abortSignal: AbortSignal;
    readRotation: () => number;
}>) {
    const lastFrame = {
        time: performance.now(),
    };

    const decoder = new VideoDecoder({
        output(frame) {
            lastFrame.time = performance.now();
            const rotation = readRotation();
            const isSideways = rotation % 180 !== 0;
            const width = isSideways ? frame.displayHeight : frame.displayWidth;
            const height = isSideways ? frame.displayWidth : frame.displayHeight;

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }

            context.setTransform(
                new DOMMatrix().translateSelf(width / 2, height / 2).rotateSelf(rotation),
            );
            context.drawImage(frame, -frame.displayWidth / 2, -frame.displayHeight / 2);
            frame.close();
        },
        error() {
            /** The next `decode` call throws once the decoder closes, which triggers a reconnect. */
        },
    });

    /**
     * Closes this attempt's connection when decoding fails. Otherwise the abandoned stream stays
     * open, and the browser's per-host connection limit eventually blocks every reconnect.
     */
    const attemptController = new AbortController();

    /**
     * A stalled connection (dropped Wi-Fi, a sleeping device, a stuck decoder) can stay open
     * without ever erroring, so reconnect whenever frames stop being drawn.
     */
    const stallCheck = setInterval(
        () => {
            if (
                performance.now() - lastFrame.time >
                convertDuration(stalledStreamTimeout, {milliseconds: true}).milliseconds
            ) {
                attemptController.abort();
            }
        },
        convertDuration({seconds: 1}, {milliseconds: true}).milliseconds,
    );

    try {
        const response = await fetch(streamEndpoint.path, {
            signal: AbortSignal.any([
                abortSignal,
                attemptController.signal,
            ]),
        });
        const reader = assertWrap.isDefined(response.body).getReader();
        let remainder: Uint8Array = new Uint8Array();

        /** A loop instead of recursion so the never-ending stream doesn't build a promise chain. */
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
            const result = splitStreamFrames(
                concatBytes({
                    previous: remainder,
                    next: chunk.value,
                }),
            );
            remainder = result.remainder;
            result.frames.forEach((frame) => decodeFrame(decoder, frame));
        }
    } finally {
        clearInterval(stallCheck);
        attemptController.abort();

        if (decoder.state !== 'closed') {
            decoder.close();
        }
    }
}

function decodeFrame(decoder: VideoDecoder, frame: Readonly<AccessUnit>) {
    if (decoder.state === 'unconfigured') {
        /** The backend always starts a stream on a keyframe, which carries the SPS. */
        decoder.configure({
            codec: assertWrap.isDefined(extractAvcCodecString(frame.data)),
            optimizeForLatency: true,
        });
    }

    decoder.decode(
        new EncodedVideoChunk({
            type: frame.isKeyframe ? 'key' : 'delta',
            timestamp: Math.round(performance.now() * 1000),
            data: frame.data,
        }),
    );
}

function concatBytes({
    previous,
    next,
}: Readonly<{
    previous: Readonly<Uint8Array>;
    next: Readonly<Uint8Array>;
}>) {
    if (!previous.byteLength) {
        return next;
    }

    const combined = new Uint8Array(previous.byteLength + next.byteLength);
    combined.set(previous);
    combined.set(next, previous.byteLength);

    return combined;
}
