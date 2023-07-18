function getJasmineVersion(): string {
    const versionStr: string =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
        (jasmine as any).version as string || (jasmine.getEnv() as any).versionString() as string;
    return versionStr;
}


beforeAll(() => {
    console.log("Running Jasmine " + getJasmineVersion() + ".");
});


describe("jasmine", () => {

    it("version will be printed while running the unit tests", () => {
        expect(getJasmineVersion()).toBe("4.6.0");
    });

});
