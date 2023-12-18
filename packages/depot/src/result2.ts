


abstract class ResultBase {
    // public abstract get succeeded(): boolean;
    // public abstract get failed(): boolean;

    public bind<TInS, TInE, TOutS, TOutE>(
        this: Result<TInS, TInE>,
        fn: (x: TInS) => Result<TOutS, TOutE>
    ): Result<TOutS, TInE | TOutE> {
        return this.succeeded ?
            fn(this.value) :
            this;
    }
}

export class SucceededResult<TS> extends ResultBase {

    public constructor(public readonly value: TS) {
        super();
    }

    public readonly succeeded = true as const;
    public readonly failed = false as const;
    public readonly error = undefined;
}

export class FailedResult<TE> extends ResultBase {

    public constructor(public readonly error: TE) {
        super();
    }

    public readonly succeeded = false as const;
    public readonly failed = true as const;
    public readonly value = undefined;
}


export type Result<TS, TE> = SucceededResult<TS> | FailedResult<TE>;


export function doIt(n: number, s: string): void {
    // foo
}


doIt(0, "hello");
