import { getAttr, getBoolAttr, hasRootElem, toXmlDoc } from "./xmlHelpers.mjs";
import { File } from "./file.mjs";
import { tmpDir } from "./specHelpers.test.mjs";


describe("toXmlDoc()", () => {

    it("fails when given a File that does not contain valid XML", async () => {
        tmpDir.emptySync();
        const file = new File(tmpDir, "not-xml.xml");
        file.writeSync("not valid xml");

        const res = await toXmlDoc(file);
        expect(res.failed).toBeTrue();
    });


    it("fails when given a string that is not valid XML", async () => {
        const res = await toXmlDoc("not valid xml");
        expect(res.failed).toBeTrue();
    });


    it("can create a document from a valid File", async () => {
        tmpDir.emptySync();
        const file = new File(tmpDir, "valid.xml");
        file.writeSync("<root><child></child></root>");

        const res = await toXmlDoc(file);
        expect(res.succeeded).toBeTrue();
    });


    it("can create a document from vaild XML text", async () => {
        const res = await toXmlDoc("<root><child></child></root>");
        expect(res.succeeded).toBeTrue();
    });

});


describe("hasRootElem()", () => {

    it("returns false when the specified name does not match the root element", async () => {
        const hasRoot = await hasRootElem("<root><child></child></root>", "child");
        expect(hasRoot).toBeFalse();
    });


    it("return true when the specified name matches the root element name", async () => {
        const hasRoot = await hasRootElem("<root><child></child></root>", "root");
        expect(hasRoot).toBeTrue();
    });

});


describe("getAttr()", () => {

    it("returns a failure Result with an error message when the attribute does not exist", async () => {
        const doc = (await toXmlDoc("<root></root>")).throwIfFailed();
        const res = getAttr(doc.documentElement, "absentAttr");
        expect(res.failed).toBeTrue();
        expect(res.error!.length).toBeGreaterThan(0);
    });


    it("returns a successful Result with the value when the attribute exists", async () => {
        const doc = (await toXmlDoc('<root val="1"></root>')).throwIfFailed();
        const res = getAttr(doc.documentElement, "val");
        expect(res.succeeded).toBeTrue();
        expect(res.value).toEqual("1");
    });

});


describe("getBoolAttr()", () => {

    it("returns false when the attribute is absent", async () => {
        const doc = (await toXmlDoc("<root></root>")).throwIfFailed();
        const val = getBoolAttr(doc.documentElement, "val");
        expect(val).toBeFalse();
    });


    it("returns false when the attribute is explicitly set to 'false'", async () => {
        const doc = (await toXmlDoc('<root val="false"></root>')).throwIfFailed();
        const val = getBoolAttr(doc.documentElement, "val");
        expect(val).toBeFalse();
    });


    it("returns false when the attribute is explicitly set to 'fAlSe'", async () => {
        const doc = (await toXmlDoc('<root val="fAlSe"></root>')).throwIfFailed();
        const val = getBoolAttr(doc.documentElement, "val");
        expect(val).toBeFalse();
    });


    it("returns false when the attribute is explicitly set to neither 'true' nor 'false'", async () => {
        const doc = (await toXmlDoc('<root val="foobar"></root>')).throwIfFailed();
        const val = getBoolAttr(doc.documentElement, "val");
        expect(val).toBeFalse();
    });


    it("returns true when the attribute is present and set to 'true'", async () => {
        const doc = (await toXmlDoc('<root val="true"></root>')).throwIfFailed();
        const val = getBoolAttr(doc.documentElement, "val");
        expect(val).toBeTrue();
    });


    it("returns true when the attribute is present and set to 'tRuE", async () => {
        const doc = (await toXmlDoc('<root val="tRuE"></root>')).throwIfFailed();
        const val = getBoolAttr(doc.documentElement, "val");
        expect(val).toBeTrue();
    });
});
