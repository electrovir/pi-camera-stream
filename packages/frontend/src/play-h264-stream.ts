// cspell:word unconfigured

import {assertWrap} from '@augment-vir/assert';
import {wait} from '@augment-vir/common';
import {
    extractAvcCodecString,
    splitStreamFrames,
    streamEndpoint,
    type AccessUnit,
} from '@pi-camera-stream/common';

/**
 * Plays the backend's H.264 stream into the given canvas until `abortSignal` fires, reconnecting
 * whenever the stream drops. Requires an HTTPS page because browsers only expose `VideoDecoder` in
 * secure contexts.
 */
export async function playH264Stream({
    canvas,
    abortSignal,
}: Readonly<{
    canvas: HTMLCanvasElement;
    abortSignal: AbortSignal;
}>) {
    const context = assertWrap.isDefined(canvas.getContext('2d'));

    while (!abortSignal.aborted) {
        try {
            await playUntilDisconnected({
                canvas,
                context,
                abortSignal,
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
}: Readonly<{
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    abortSignal: AbortSignal;
}>) {
    const decoder = new VideoDecoder({
        output(frame) {
            if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
                canvas.width = frame.displayWidth;
                canvas.height = frame.displayHeight;
            }

            context.drawImage(frame, 0, 0);
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
