import { Tree } from "./tree.mjs";
import { toTreeTable } from "./treeTable.mjs";
import { splitIntoLines } from "./stringHelpers.mjs";
import { pipe } from "./pipe2.mjs";


// An empty tree
const treeEmpty = new Tree<string[]>();


// A single node tree
const treeSingle = new Tree<string[]>();
const treeSinglen1 = treeSingle.insert(undefined, undefined, ["1", "1a", "1b", "1c"]);


// treeFull
// ├─ 1
// │  ├─ 1.1
// │  │  ├─ 1.1.1
// │  │  └─ 1.1.2
// │  └─ 1.2
// └─ 2
//    └─ 2.1
//       └─ 2.1.1
const treeFull = new Tree<string[]>();
const treeFulln1 = treeFull.insert(undefined, undefined, ["1", "1a", "1b", "1c"]);
const treeFulln1n1 = treeFull.insert(treeFulln1, undefined, ["1.1", "1.1a", "1.1b", "1.1c"]);
const treeFulln1n1n1 = treeFull.insert(treeFulln1n1, undefined, ["1.1.1", "1.1.1a", "1.1.1b", "1.1.1c"]);
const treeFulln1n1n2 = treeFull.insert(treeFulln1n1, undefined, ["1.1.2", "1.1.2a", "1.1.2b", "1.1.2c"]);
const treeFulln1n2 = treeFull.insert(treeFulln1, undefined, ["1.2", "1.2a", "1.2b", "1.2c"]);
const treeFulln2 = treeFull.insert(undefined, undefined, ["2", "2a", "2b", "2c"]);
const treeFulln2n1 = treeFull.insert(treeFulln2, undefined, ["2.1", "2.1a", "2.1b", "2.1c"]);
const treeFulln2n1n1 = treeFull.insert(treeFulln2n1, undefined, ["2.1.1", "2.1.1a", "2.1.1b", "2.1.1c"]);

// treeML (multi-line)
// ├─ 1
// │  1 - line 2
// │  ├─ 1.1
// │  │  ├─ 1.1.1
// │  │  └─ 1.1.2
// │  └─ 1.2
// └─ 2
//    └─ 2.1
//       └─ 2.1.1
// const treeML = new Tree<string[]>();
// const treeMLn1 = treeFull.insert(undefined, undefined, ["1", "1a", "1b", "1c"]);
// const treeMLn1n1 = treeFull.insert(treeFulln1, undefined, ["1.1", "1.1a", "1.1b", "1.1c"]);
// const treeMLn1n1n1 = treeFull.insert(treeFulln1n1, undefined, ["1.1.1", "1.1.1a", "1.1.1b", "1.1.1c"]);
// const treeMLn1n1n2 = treeFull.insert(treeFulln1n1, undefined, ["1.1.2", "1.1.2a", "1.1.2b", "1.1.2c"]);
// const treeMLn1n2 = treeFull.insert(treeFulln1, undefined, ["1.2", "1.2a", "1.2b", "1.2c"]);
// const treeMLn2 = treeFull.insert(undefined, undefined, ["2", "2a", "2b", "2c"]);
// const treeMLn2n1 = treeFull.insert(treeFulln2, undefined, ["2.1", "2.1a", "2.1b", "2.1c"]);
// const treeMLn2n1n1 = treeFull.insert(treeFulln2n1, undefined, ["2.1.1", "2.1.1a", "2.1.1b", "2.1.1c"]);


describe("toTreeTable()", () => {

    it("produces the expected output for an empty tree", () => {
        const lines = pipe(
            toTreeTable(treeEmpty, { colHeaders: ["root text"] }),
            (str) => splitIntoLines(str)
        );
        expect(lines).toEqual([
            "root text"
        ]);
    });


    it("produces the expected output for a single node tree", () => {
        const lines = pipe(
            toTreeTable(treeSingle, { colHeaders: ["root text"] }),
            (str) => splitIntoLines(str)
        );
        expect(lines).toEqual([
            "root text",
            "└─ 1"
        ]);
    });


    it("produces the expected output for a full tree", () => {
        const lines = pipe(
            toTreeTable(treeFull, { colHeaders: ["root text"] }),
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


    it("can have a multi-line title", () => {
        const lines = pipe(
            toTreeTable(treeFull, { colHeaders: ["title - line 1\ntitle - line 2"] }),
            (str) => splitIntoLines(str)
        );
        expect(lines).toEqual([
            "title - line 1",
            "title - line 2",
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
