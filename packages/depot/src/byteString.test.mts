import { ByteString } from "../src/byteString.mjs";


describe("ByteString", () => {

    describe("static", () => {

        describe("create()", () => {

            it("fails when there is an illegal character at the beginning", () => {
                const input = "K 01 2 03 4 05     ";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeFalse();
            });


            it("fails when there is an illegal character as the first non whitespace", () => {
                const input = " K 01 2 03 4 05     ";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeFalse();
            });


            it("fails when there is an illegal character in the middle", () => {
                const input = " 01 2 0X 4 05     ";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeFalse();
            });


            it("fails when there is an illegal character as the last non whitespace", () => {
                const input = " 01 2 03 4 05  _   ";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeFalse();
            });

            it("fails when there is an illegal character at the end", () => {
                const input = " 01 2 03 4 05  #";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeFalse();
            });


            it("succeeds when given an empty string", () => {
                const input = "";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.length).toEqual(0);
            });


            it("succeeds when given a string containing leanding whitespace", () => {
                const input = "   1 d a";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.length).toEqual(3);
            });


            it("succeeds when given a string containing trailing whitespace", () => {
                const input = "1 d a ";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.length).toEqual(3);
            });


            it("succeeds when given a string containing leading and trailing whitespace", () => {
                const input = " 01 2 03 4 05     ";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.length).toEqual(5);
            });


            it("succeeds when given a string with no whitespace", () => {
                const input = "1122334455";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.length).toEqual(5);
            });

        });

    });


    describe("instance", () => {


        describe("toString()", () => {

            it("returns the original string including whitespace and single digit bytes", () => {
                const input = "  01 2 03 4 05     ";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.toString()).toEqual("  01 2 03 4 05     ");
            });

        });


        describe("toNormalizedString()", () => {

            it("removes leading whitespace", () => {
                const input = "  \t  01 2 03 4 05";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.toNormalizedString()).toEqual("01 02 03 04 05");
            });


            it("removes trailing whitespace", () => {
                const input = "01 2 03 4 05   \t";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.toNormalizedString()).toEqual("01 02 03 04 05");
            });


            it("reduces middle whitespace to a single space", () => {
                const input = "01 \t\t 2  \t   03 4 05";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.toNormalizedString()).toEqual("01 02 03 04 05");
            });


            it("converts single digit bytes to double digit bytes", () => {
                const input = "01 2 03 4 05";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.toNormalizedString()).toEqual("01 02 03 04 05");
            });


            it("reduces whitespace to a single space", () => {
                const input = "   01\t\t2      03  \t   4 05  \t  ";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.toNormalizedString()).toEqual("01 02 03 04 05");
            });


            it("converts uppercase A through F to lowercase", () => {
                const input = "0A B 0C D 0E";
                const res = ByteString.create(input);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.toNormalizedString()).toEqual("0a 0b 0c 0d 0e");
            });

        });

    });

});
