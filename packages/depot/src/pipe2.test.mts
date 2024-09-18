import {partial} from "lodash-es";
import { pipe } from "./pipe2.mjs";


const _ = partial.placeholder;


describe("pipe()", () => {


    it("pipes a value through the specified functions", () => {
        const result =
            pipe(
                "5",
                (str) => parseInt(str, 10),
                (n) => n * 3,
                (n) => n + 1,
                (n) => n.toString(),
                (str) => str + "!"
            );
        expect(result).toEqual("16!");
    });


    it("can be used easily with lodash's partial()", () => {

        const result =
            pipe(
                "5",
                partial(parseInt, _, 10),
                (n) => n * 3
            );

        expect(result).toEqual(15);
    });


});
