// cspell:words golomb
/** The H.264 NAL unit types this package needs to distinguish. */
export enum NalUnitType {
    NonIdrSlice = 1,
    IdrSlice = 5,
    Sei = 6,
    Sps = 7,
    Pps = 8,
    AccessUnitDelimiter = 9,
}

const sliceTypes: ReadonlyArray<number> = [
    NalUnitType.NonIdrSlice,
    NalUnitType.IdrSlice,
];

/** NAL units that can only appear before a frame's first slice. */
const frameStartTypes: ReadonlyArray<number> = [
    NalUnitType.Sei,
    NalUnitType.Sps,
    NalUnitType.Pps,
    NalUnitType.AccessUnitDelimiter,
];

export type NalUnit = {
    /** Index of the NAL unit's start code. */
    start: number;
    /** Index of the NAL unit's header byte, right after the start code. */
    headerIndex: number;
    type: number;
};

export type AccessUnit = {
    /** Whether this access unit can be decoded on its own. */
    isKeyframe: boolean;
    /** Annex B bytes, start codes included. */
    data: Uint8Array;
};

/** Finds every NAL unit in Annex B data by its `00 00 01` or `00 00 00 01` start code. */
export function findNalUnits(data: Uint8Array): NalUnit[] {
    const nalUnits: NalUnit[] = [];

    for (
        let oneIndex = data.indexOf(1, 2);
        oneIndex !== -1;
        oneIndex = data.indexOf(1, oneIndex + 1)
    ) {
        if (data[oneIndex - 1] === 0 && data[oneIndex - 2] === 0) {
            const headerIndex = oneIndex + 1;

            nalUnits.push({
                start: data[oneIndex - 3] === 0 ? oneIndex - 3 : oneIndex - 2,
                headerIndex,
                /** The header byte may not have arrived yet. */
                type: (data[headerIndex] ?? 0) & 0x1f,
            });
        }
    }

    return nalUnits;
}

function startsNewFrame(data: Readonly<Uint8Array>, nalUnit: Readonly<NalUnit>) {
    if (sliceTypes.includes(nalUnit.type)) {
        /**
         * The slice header starts with `first_mb_in_slice` as an Exp-Golomb number, which is 0
         * (encoded as a single `1` bit) only for a frame's first slice.
         */
        return ((data[nalUnit.headerIndex + 1] ?? 0) & 0x80) !== 0;
    }

    return frameStartTypes.includes(nalUnit.type);
}

/**
 * Groups raw Annex B camera output into access units (one per video frame). Bytes after the last
 * complete frame are returned as `remainder` to prepend to the next chunk.
 *
 * A frame is only known to be complete once the next frame starts, so each frame is emitted one
 * frame late.
 */
export function splitAccessUnits(data: Uint8Array) {
    const nalUnits = findNalUnits(data);

    const {accessUnits, frameStart} = nalUnits.reduce<{
        accessUnits: AccessUnit[];
        frameStart: number;
        hasSlice: boolean;
        isKeyframe: boolean;
    }>(
        (state, nalUnit) => {
            const isNewFrame = state.hasSlice && startsNewFrame(data, nalUnit);
            const current = isNewFrame
                ? {
                      accessUnits: [
                          ...state.accessUnits,
                          {
                              isKeyframe: state.isKeyframe,
                              data: data.subarray(state.frameStart, nalUnit.start),
                          },
                      ],
                      frameStart: nalUnit.start,
                      hasSlice: false,
                      isKeyframe: false,
                  }
                : state;

            return {
                ...current,
                hasSlice: current.hasSlice || sliceTypes.includes(nalUnit.type),
                isKeyframe: current.isKeyframe || nalUnit.type === NalUnitType.IdrSlice,
            };
        },
        {
            accessUnits: [],
            frameStart: nalUnits[0]?.start ?? 0,
            hasSlice: false,
            isKeyframe: false,
        },
    );

    return {
        accessUnits,
        remainder: data.subarray(frameStart),
    };
}

/**
 * Builds the WebCodecs `codec` string (like `avc1.640028`) from the SPS inside a keyframe. Returns
 * `undefined` if the access unit has no SPS.
 */
export function extractAvcCodecString(accessUnit: Readonly<Uint8Array>) {
    const sps = findNalUnits(accessUnit).find((nalUnit) => nalUnit.type === NalUnitType.Sps);

    if (!sps) {
        return undefined;
    }

    /** Profile, constraint flags, and level: the three bytes after the SPS header. */
    const profileBytes = accessUnit.subarray(sps.headerIndex + 1, sps.headerIndex + 4);

    return `avc1.${[...profileBytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
