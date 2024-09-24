import { Uuid } from "../src/uuid.mjs";
import { Brand } from "../src/brand.mjs";


type FooId = Brand<Uuid, "FooId">;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type BarId = Brand<Uuid, "BarId">;


// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fooOp(foo: FooId): void {
}


// Since branding is a typing technique, there are no runnable unit tests. The
// following provides examples of type checks that branding (nominal typing)
// makes possible.

// const foo = Uuid.create() as FooId;
// const bar: BarId = Uuid.create() as BarId;
// fooOp(foo);         // Legal
// fooOp(bar);         // Error
