import { z } from "zod";


export interface IDeserialize<TValue> {

    /**
     * Zod schema that validates and transforms an unknown payload into the
     * concrete data type instance.  Can be composed into larger schemas.
     */
    readonly schema: z.ZodType<TValue>;

}


export interface ISerializable {

    /**
     * Serializes this instance to a plain object suitable for JSON
     * serialization.
     *
     * @return A plain object representing this instance.
     */
    serialize(): { $type: string };

}
