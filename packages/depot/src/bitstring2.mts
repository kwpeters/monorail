import { UInt8, UInt16, UInt32 } from "./primitiveDataType.mjs";
import { Result, SucceededResult } from "./result.mjs";


export type BitNumber<T> =
  T extends UInt8 ? 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 :
  T extends UInt16 ? 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 :
  T extends UInt32 ? 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
                    16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 :
  never;


export type BitRange<T> =
    { type: "BitfieldDefBookends",     lowBit: BitNumber<T>; highBit: BitNumber<T> } |
    { type: "BitfieldDefLowBitAndSize", lowBit: BitNumber<T>; numBits: number };


export class Bitstring<T extends UInt8 | UInt16 | UInt32, TDef extends Record<string, BitRange<T>>> {

    static create<T extends UInt8 | UInt16 | UInt32, TDef extends Record<string, BitRange<T>>>(
        backing: T,
        defs: TDef
    ): Bitstring<T, TDef> {
        return new Bitstring(backing, defs);
    }


    private readonly _backing: T;
    private readonly _defs:    TDef;


    private constructor(backing: T, defs: TDef) {
        this._backing = backing;
        this._defs = defs;

        // Runtime checks for bitfield validity
        const maxBit = backing instanceof UInt8 ? 7 :
                       backing instanceof UInt16 ? 15 : 31;

        for (const key in defs) {
            if (!Object.prototype.hasOwnProperty.call(defs, key)) {
                continue;
            }
            const def = defs[key]!;
            if ("numBits" in def) {
                const highBit = def.lowBit + def.numBits - 1;
                if (highBit > maxBit) {
                    throw new Error(`Bitfield "${key}" exceeds maximum bit index (${maxBit})`);
                }
            }
            else {
                // Even though the type system checks this for literals,
                // add a runtime check for safety with non-literal values
                if (def.highBit > maxBit) {
                    throw new Error(`Bitfield "${key}" has highBit (${def.highBit}) exceeding maximum (${maxBit})`);
                }
                if (def.lowBit > def.highBit) {
                    throw new Error(`Bitfield "${key}" has lowBit (${def.lowBit}) greater than highBit (${def.highBit})`);
                }
            }
        }
    }

    getBitfield(key: keyof TDef): number {
        const def = this._defs[key]!;

        const numBitfieldBits = def.type === "BitfieldDefLowBitAndSize" ?
            def.numBits :
            def.highBit - def.lowBit + 1;

        // Create a mask to extract the bits from the value.
        const mask = (1 << numBitfieldBits) - 1;

        // Shift the value to the right by the low bit and apply the mask.
        const shiftedValue = (this._backing.value >> def.lowBit) & mask;
        return shiftedValue;
    }
}
