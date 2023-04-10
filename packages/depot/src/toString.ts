

export interface IToString {
    toString(): string;
}


export function isIToString(other: unknown): other is IToString {
    const otherAny = other as IToString;
    return otherAny.toString &&
           typeof otherAny.toString === "function";
}
