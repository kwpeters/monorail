import {Transform} from "stream";
import {Deferred} from "@repo/depot/deferred";


/**
 * A stream that prefixes each line with a specified string.
 */
export class PrefixStream extends Transform {
    // region Private Members
    private readonly _prefixBuf:       Buffer;
    private _partial:                  Buffer | undefined;
    private readonly _flushedDeferred: Deferred<void>;
    // endregion


    constructor(prefix: string) {
        super();
        this._prefixBuf = Buffer.from(`[${prefix}] `);
        this._flushedDeferred = new Deferred<void>();
    }


    public get prefix(): string {
        return this._prefixBuf.toString();
    }


    public get flushedPromise(): Promise<void> {
        return this._flushedDeferred.promise;
    }


    public override _transform(chunk: Buffer | string, encoding: string, done: () => unknown): void {
        // Convert to a Buffer.
        const chunkBuf: Buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;

        this._partial = (this._partial?.length) ?
            Buffer.concat([this._partial, chunkBuf]) :
            chunkBuf;

        // While complete lines exist, push them.
        let index: number = this._partial.indexOf("\n");
        while (index !== -1) {
            const line = this._partial.slice(0, ++index);
            this._partial = this._partial.slice(index);
            this.push(Buffer.concat([this._prefixBuf, line]));

            index = this._partial.indexOf("\n");
        }
        done();
    }


    public override _flush(done: () => unknown): void {
        if (this._partial?.length) {
            this.push(Buffer.concat([this._prefixBuf, this._partial]));
        }
        this._flushedDeferred.resolve(undefined);

        done();
    }
}
