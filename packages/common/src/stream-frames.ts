import {type AccessUnit} from './h264.js';

/** One flag byte plus a 4-byte big-endian length. */
const frameHeaderLength = 5;

/**
 * Creates the header that the stream endpoint writes before each access unit, so the frontend can
 * split the byte stream back into frames with {@link splitStreamFrames}.
 */
export function createStreamFrameHeader({isKeyframe, data}: Readonly<AccessUnit>) {
    const header = new Uint8Array(frameHeaderLength);
    const view = new DataView(header.buffer);

    view.setUint8(0, isKeyframe ? 1 : 0);
    view.setUint32(1, data.byteLength);

    return header;
}

/**
 * Splits bytes from the stream endpoint back into access units. Bytes after the last complete frame
 * are returned as `remainder` to prepend to the next chunk.
 */
export function splitStreamFrames(data: Uint8Array) {
    const frames: AccessUnit[] = [];
    let offset = 0;

    while (offset + frameHeaderLength <= data.byteLength) {
        const view = new DataView(data.buffer, data.byteOffset + offset, frameHeaderLength);
        const frameEnd = offset + frameHeaderLength + view.getUint32(1);

        if (frameEnd > data.byteLength) {
            break;
        }

        frames.push({
            isKeyframe: view.getUint8(0) === 1,
            data: data.subarray(offset + frameHeaderLength, frameEnd),
        });
        offset = frameEnd;
    }

    return {
        frames,
        remainder: data.subarray(offset),
    };
}
