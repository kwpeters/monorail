import {Transform} from "node:stream";
import {Deferred} from "@repo/depot/deferred";


export class CollectorStream extends Transform {
    // region Private Members
    private _collected:                Buffer;
    private readonly _flushedDeferred: Deferred<void>;
    // endregion


    constructor() {
        super();
        this._collected = Buffer.from("");
        this._flushedDeferred = new Deferred<void>();
    }


    public get collected(): string {
        return this._collected.toString();
    }


    public get flushedPromise(): Promise<void> {
        return this._flushedDeferred.promise;
    }


    public override _transform(chunk: Buffer | string, encoding: string, done: () => unknown): void {
        // Convert to a Buffer.
        const chunkBuf: Buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;

        this._collected = Buffer.concat([this._collected, chunkBuf]);
        this.push(chunkBuf);
        done();
    }


    public override _flush(done: () => unknown): void {
        this._flushedDeferred.resolve(undefined);
        done();
    }
}
