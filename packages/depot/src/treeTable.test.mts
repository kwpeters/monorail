import { Tree } from "./tree.mjs";
import { toTreeTable } from "./treeTable.mjs";
import { splitIntoLines } from "./stringHelpers.mjs";
import { pipe } from "./pipe2.mjs";


// An empty tree
const treeEmpty = new Tree<string[]>();


// A single node tree
const treeSingle = new Tree<string[]>();
const treeSingleN1 = treeSingle.insert(undefined, undefined, ["1", "1a", "1b", "1c"]);


// A full tree
// ├─ 1
// │  ├─ 1.1
// │  │  ├─ 1.1.1
// │  │  └─ 1.1.2
// │  └─ 1.2
// └─ 2
//    └─ 2.1
//       └─ 2.1.1
const treeFull = new Tree<string[]>();
const n1 = treeFull.insert(undefined, undefined, ["1", "1a", "1b", "1c"]);
const n1n1 = treeFull.insert(n1, undefined, ["1.1", "1.1a", "1.1b", "1.1c"]);
const n1n1n1 = treeFull.insert(n1n1, undefined, ["1.1.1", "1.1.1a", "1.1.1b", "1.1.1c"]);
const n1n1n2 = treeFull.insert(n1n1, undefined, ["1.1.2", "1.1.2a", "1.1.2b", "1.1.2c"]);
const n1n2 = treeFull.insert(n1, undefined, ["1.2", "1.2a", "1.2b", "1.2c"]);
const n2 = treeFull.insert(undefined, undefined, ["2", "2a", "2b", "2c"]);
const n2n1 = treeFull.insert(n2, undefined, ["2.1", "2.1a", "2.1b", "2.1c"]);
const n2n1n1 = treeFull.insert(n2n1, undefined, ["2.1.1", "2.1.1a", "2.1.1b", "2.1.1c"]);



describe("toTreeTable()", () => {

    it("produces the expected output for an empty tree", () => {
        const lines = pipe(
            toTreeTable(treeEmpty, "root text"),
            (str) => splitIntoLines(str)
        );
        expect(lines).toEqual([
            "root text"
        ]);
    });


    it("produces the expected output for a single node tree", () => {
        const lines = pipe(
            toTreeTable(treeSingle, "root text"),
            (str) => splitIntoLines(str)
        );
        expect(lines).toEqual([
            "root text",
            "└─ 1"
        ]);
    });


    it("produces the expected output for a full tree", () => {
        const lines = pipe(
            toTreeTable(treeFull, "root text"),
            (str) => splitIntoLines(str)
        );
        expect(lines).toEqual([
            "root text",
            "├─ 1",
            "│  ├─ 1.1",
            "│  │  ├─ 1.1.1",
            "│  │  └─ 1.1.2",
            "│  └─ 1.2",
            "└─ 2",
            "   └─ 2.1",
            "      └─ 2.1.1",
        ]);
    });


});
