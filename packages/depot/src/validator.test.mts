import { Validator, alwaysValid } from "./validator.mjs";


function dotNotAllowedAsync(subject: string): Promise<boolean> {
    const dotFound = subject.includes(".");
    return Promise.resolve(!dotFound);
}


function dollarNotAllowedSync(subject: string): boolean {
    const dollarFound = subject.includes("$");
    return !dollarFound;
}


function containsSecretAsync(subject: string): Promise<boolean> {
    const containsSecret = subject.includes("xyzzy");
    return Promise.resolve(containsSecret);
}


describe("Validator", () => {

    describe("static", () => {

        describe("constructor", () => {

            it("will create a new instance", () => {
                expect(new Validator([dotNotAllowedAsync])).toBeTruthy();
            });


        });
    });


    describe("instance", () => {

        describe("isValid()", () => {

            it("will return false when a sync validator finds a problem", async () => {
                const validator = new Validator([dotNotAllowedAsync, dollarNotAllowedSync, containsSecretAsync]);
                expect(await validator.isValid("this $ is invalid")).toBeFalsy();
            });


            it("will return false when an async validator finds a problem", async () => {
                const validator = new Validator([dotNotAllowedAsync, dollarNotAllowedSync, containsSecretAsync]);
                expect(await validator.isValid("this . is invalid")).toBeFalsy();
            });


            it("will return true when all validators succeed", async () => {
                const validator = new Validator([dotNotAllowedAsync, dollarNotAllowedSync, containsSecretAsync]);
                expect(await validator.isValid("no dots, no dollars, contains secrety xyzzy")).toBeTruthy();
            });


        });


    });


});


describe("Utility Validator Functions", () => {

    describe("alwaysValid()", () => {

        it("always returns that the subject is valid", () => {
            expect(alwaysValid(undefined)).toEqual(true);
            expect(alwaysValid(null)).toEqual(true);
            expect(alwaysValid(0)).toEqual(true);
            expect(alwaysValid([])).toEqual(true);
            expect(alwaysValid("")).toEqual(true);
            expect(alwaysValid(true)).toEqual(true);
            expect(alwaysValid(1)).toEqual(true);
            expect(alwaysValid("hello")).toEqual(true);
        });

    });

});
