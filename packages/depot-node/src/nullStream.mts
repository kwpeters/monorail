import { Writable } from "node:stream";

export class NullStream extends Writable {

    public override _write(chunk: string | Buffer, encoding: string, callback: () => unknown): void {
        callback();
    }

}
