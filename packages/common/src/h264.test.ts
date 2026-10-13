import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {extractAvcCodecString, NalUnitType, splitAccessUnits} from './h264.js';

function createNalUnit(type: NalUnitType, payload: ReadonlyArray<number> = [0x80]) {
    return [
        0,
        0,
        0,
        1,
        type,
        ...payload,
    ];
}

const sps = createNalUnit(
    NalUnitType.Sps,
    [
        0x64,
        0x00,
        0x28,
    ],
);
const keyframe = [
    ...sps,
    ...createNalUnit(NalUnitType.IdrSlice),
];
const deltaFrame = createNalUnit(NalUnitType.NonIdrSlice);

describe(splitAccessUnits.name, () => {
    it('groups NAL units into frames and keeps the unfinished frame as remainder', () => {
        const result = splitAccessUnits(
            new Uint8Array([
                ...keyframe,
                ...deltaFrame,
                ...deltaFrame,
            ]),
        );

        assert.deepEquals(
            {
                accessUnits: result.accessUnits.map((accessUnit) => {
                    return {
                        ...accessUnit,
                        data: [...accessUnit.data],
                    };
                }),
                remainder: [...result.remainder],
            },
            {
                accessUnits: [
                    {
                        isKeyframe: true,
                        data: keyframe,
                    },
                    {
                        isKeyframe: false,
                        data: deltaFrame,
                    },
                ],
                remainder: deltaFrame,
            },
        );
    });
    it('finds a start code split across chunks', () => {
        const stream = new Uint8Array([
            ...deltaFrame,
            ...deltaFrame,
        ]);
        const first = splitAccessUnits(stream.subarray(0, deltaFrame.length + 2));
        const second = splitAccessUnits(
            new Uint8Array([
                ...first.remainder,
                ...stream.subarray(deltaFrame.length + 2),
            ]),
        );

        assert.deepEquals(
            {
                firstCount: first.accessUnits.length,
                secondFrames: second.accessUnits.map((accessUnit) => [...accessUnit.data]),
            },
            {
                firstCount: 0,
                secondFrames: [
                    deltaFrame,
                ],
            },
        );
    });
});

describe(`${splitAccessUnits.name} with multiple slices per frame`, () => {
    it('keeps every slice of a frame together', () => {
        const secondSlice = createNalUnit(NalUnitType.NonIdrSlice, [0x40]);
        const twoSliceFrame = [
            ...deltaFrame,
            ...secondSlice,
        ];

        const result = splitAccessUnits(
            new Uint8Array([
                ...twoSliceFrame,
                ...deltaFrame,
            ]),
        );

        assert.deepEquals(
            result.accessUnits.map((accessUnit) => [...accessUnit.data]),
            [
                twoSliceFrame,
            ],
        );
    });
});

describe(extractAvcCodecString.name, () => {
    it('reads the profile and level from the SPS', () => {
        assert.strictEquals(extractAvcCodecString(new Uint8Array(keyframe)), 'avc1.640028');
    });
    it('returns undefined without an SPS', () => {
        assert.isUndefined(extractAvcCodecString(new Uint8Array(deltaFrame)));
    });
});
