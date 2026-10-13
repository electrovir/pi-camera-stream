import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {createStreamFrameHeader, splitStreamFrames} from './stream-frames.js';

const frames = [
    {
        isKeyframe: true,
        data: new Uint8Array([
            1,
            2,
            3,
        ]),
    },
    {
        isKeyframe: false,
        data: new Uint8Array([
            4,
        ]),
    },
];

const encoded = new Uint8Array(
    frames.flatMap((frame) => {
        return [
            ...createStreamFrameHeader(frame),
            ...frame.data,
        ];
    }),
);

describe(splitStreamFrames.name, () => {
    it('decodes frames written with their headers', () => {
        assert.deepEquals(splitStreamFrames(encoded), {
            frames,
            remainder: new Uint8Array(),
        });
    });
    it('keeps a partial frame as remainder', () => {
        const partial = encoded.subarray(0, encoded.length - 1);

        assert.deepEquals(splitStreamFrames(partial), {
            frames: frames.slice(0, 1),
            remainder: partial.subarray(8),
        });
    });
});
