import inspectLibFn from "object-inspect";


/**
 * The default options to use when getting the string representation of an
 * object.
 */
const defaultOpts = {
    quoteStyle: "double" as const
};


/**
 * An exported function that binds the default options.  This way, only an
 * object needs to be passed.
 *
 * @param obj - The object whose string representation is to be gotten
 * @return _obj_'s string representation
 */
export function inspect(obj: unknown): string {
    const str = inspectLibFn(obj, defaultOpts);
    return str;
}
