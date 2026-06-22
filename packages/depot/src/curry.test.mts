import { dispatchFirst, dispatchLast, dual, dualFlip } from "./curry.mjs";


describe("dispatchLast()", () => {

    it("runs the implementation eagerly when given all arguments (arity 2)", () => {
        const result = dispatchLast(
            2,
            [(n: number) => n * 2, 5],
            (fn: (n: number) => number, value: number) => fn(value)
        );
        expect(result).toEqual(10);
    });


    it("returns a continuation awaiting the last argument when given fewer (arity 2)", () => {
        const cont = dispatchLast(
            2,
            [(n: number) => n * 2],
            (fn: (n: number) => number, value: number) => fn(value)
        ) as (value: number) => number;
        expect(typeof cont).toEqual("function");
        expect(cont(5)).toEqual(10);
    });


    it("runs eagerly for a higher arity (arity 3)", () => {
        const result = dispatchLast(
            3,
            [1, 2, 3],
            (a: number, b: number, value: number) => a + b + value
        );
        expect(result).toEqual(6);
    });


    it("returns a continuation for a higher arity (arity 3)", () => {
        const cont = dispatchLast(
            3,
            [1, 2],
            (a: number, b: number, value: number) => a + b + value
        ) as (value: number) => number;
        expect(typeof cont).toEqual("function");
        expect(cont(3)).toEqual(6);
    });


    it("treats an explicitly-passed undefined last argument as the eager form (count-based)", () => {
        let receivedArgCount = 0;
        dispatchLast(
            2,
            ["a", undefined],
            (...args: Array<unknown>) => {
                receivedArgCount = args.length;
                return "eager";
            }
        );
        // Passing undefined explicitly still means 2 arguments → eager branch.
        expect(receivedArgCount).toEqual(2);
    });

});


describe("dispatchFirst()", () => {

    it("runs the implementation eagerly when given all arguments (value first)", () => {
        const result = dispatchFirst(
            2,
            ["foo", "bar"],
            (value: string, suffix: string) => value + suffix
        );
        expect(result).toEqual("foobar");
    });


    it("returns a continuation awaiting the value when given only the config", () => {
        const cont = dispatchFirst(
            2,
            ["bar"],
            (value: string, suffix: string) => value + suffix
        ) as (value: string) => string;
        expect(typeof cont).toEqual("function");
        expect(cont("foo")).toEqual("foobar");
    });

});


describe("dual()", () => {

    // A data-last arity-2 function: (fn, value) => fn(value)
    const apply: {
        (fn: (n: number) => number, value: number): number;
        (fn: (n: number) => number): (value: number) => number;
    } = dual(2, (fn: (n: number) => number, value: number) => fn(value));

    // A data-last arity-3 function: (a, b, value) => a + b + value
    const add3: {
        (a: number, b: number, value: number): number;
        (a: number, b: number): (value: number) => number;
    } = dual(3, (a: number, b: number, value: number) => a + b + value);


    it("when called eagerly with all arguments, runs immediately (arity 2)", () => {
        expect(apply((n) => n * 2, 5)).toEqual(10);
    });


    it("when called with one fewer argument, returns a function awaiting the last (arity 2)", () => {
        const double = apply((n) => n * 2);
        expect(typeof double).toEqual("function");
        expect(double(5)).toEqual(10);
    });


    it("when called eagerly with all arguments, runs immediately (arity 3)", () => {
        expect(add3(1, 2, 3)).toEqual(6);
    });


    it("when called with one fewer argument, returns a function awaiting the last (arity 3)", () => {
        const addTo = add3(1, 2);
        expect(typeof addTo).toEqual("function");
        expect(addTo(3)).toEqual(6);
    });

});


describe("dualFlip()", () => {

    // Eager form is value-first: (value, suffix) => value + suffix
    const append: {
        (value: string, suffix: string): string;
        (suffix: string): (value: string) => string;
    } = dualFlip(2, (value: string, suffix: string) => value + suffix);


    it("when called eagerly, runs value-first immediately", () => {
        expect(append("foo", "bar")).toEqual("foobar");
    });


    it("when curried, takes the config first and awaits the value", () => {
        const addBar = append("bar");
        expect(typeof addBar).toEqual("function");
        expect(addBar("foo")).toEqual("foobar");
    });

});
