import stripAnsi from "strip-ansi";
import { Tree } from "./tree.mjs";
import { TreeTable } from "./treeTable.mjs";
import { TextBlock } from "./textBlock.mjs";


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


// describe("toTreeTable()", () => {
//
//     it("produces the expected output for an empty tree", () => {
//         const lines = pipe(
//             toTreeTable(treeEmpty, { colHeaders: ["root text"] }),
//             (str) => splitIntoLines(str)
//         );
//         expect(lines).toEqual([
//             "root text"
//         ]);
//     });
//
//
//     it("produces the expected output for a single node tree", () => {
//         const lines = pipe(
//             toTreeTable(treeSingle, { colHeaders: ["root text"] }),
//             (str) => splitIntoLines(str)
//         );
//         expect(lines).toEqual([
//             "root text",
//             "└─ 1"
//         ]);
//     });
//
//
//     it("produces the expected output for a full tree", () => {
//         const lines = pipe(
//             toTreeTable(treeFull, { colHeaders: ["root text"] }),
//             (str) => splitIntoLines(str)
//         );
//         expect(lines).toEqual([
//             "root text",
//             "├─ 1",
//             "│  ├─ 1.1",
//             "│  │  ├─ 1.1.1",
//             "│  │  └─ 1.1.2",
//             "│  └─ 1.2",
//             "└─ 2",
//             "   └─ 2.1",
//             "      └─ 2.1.1",
//         ]);
//     });
//
//
//     it("can have a multi-line title", () => {
//         const lines = pipe(
//             toTreeTable(treeFull, { colHeaders: ["title - line 1\ntitle - line 2"] }),
//             (str) => splitIntoLines(str)
//         );
//         expect(lines).toEqual([
//             "title - line 1",
//             "title - line 2",
//             "├─ 1",
//             "│  ├─ 1.1",
//             "│  │  ├─ 1.1.1",
//             "│  │  └─ 1.1.2",
//             "│  └─ 1.2",
//             "└─ 2",
//             "   └─ 2.1",
//             "      └─ 2.1.1",
//         ]);
//     });
//
// });




// treeFull
// ├─ 1
// │  ├─ 1.1
// │  │  ├─ 1.1.1
// │  │  └─ 1.1.2
// │  └─ 1.2
// └─ 2
//    └─ 2.1
//       └─ 2.1.1
const tree2 = new Tree<readonly TextBlock[]>();
const tree2n1 = tree2.insert(
    undefined,
    undefined,
    [
        TextBlock.fromString("1"),
        TextBlock.fromString("1a"),
        TextBlock.fromString("1b"),
        TextBlock.fromString("1c"),
    ]
);
const tree2n1n1 = tree2.insert(
    tree2n1,
    undefined,
    [
        TextBlock.fromString("1.1"),
        TextBlock.fromString("1.1a"),
        TextBlock.fromString("1.1b"),
        TextBlock.fromString("1.1c"),
    ]
);
const tree2n1n1n1 = tree2.insert(
    tree2n1n1,
    undefined,
    [
        TextBlock.fromString("1.1.1"),
        TextBlock.fromString("1.1.1a"),
        TextBlock.fromString("1.1.1b"),
        TextBlock.fromString("1.1.1c"),
    ]
);
const tree2n1n1n2 = tree2.insert(
    tree2n1n1,
    undefined,
    [
        TextBlock.fromString("1.1.2"),
        TextBlock.fromString("1.1.2a"),
        TextBlock.fromString("1.1.2b"),
        TextBlock.fromString("1.1.2c"),
    ]
);
const tree2n1n2 = tree2.insert(
    tree2n1,
    undefined,
    [
        TextBlock.fromString("1.2"),
        TextBlock.fromString("1.2a"),
        TextBlock.fromString("1.2b"),
        TextBlock.fromString("1.2c"),
    ]
);
const tree2n2 = tree2.insert(
    undefined,
    undefined,
    [
        TextBlock.fromString("2"),
        TextBlock.fromString("2a"),
        TextBlock.fromString("2b"),
        TextBlock.fromString("2c")
    ]
);
const tree2n2n1 = tree2.insert(
    tree2n2,
    undefined,
    [
        TextBlock.fromString("2.1"),
        TextBlock.fromString("2.1a"),
        TextBlock.fromString("2.1b"),
        TextBlock.fromString("2.1c")
    ]
);
const tree2n2n1n1 = tree2.insert(
    tree2n2n1,
    undefined,
    [
        TextBlock.fromString("2.1.1"),
        TextBlock.fromString("2.1.1a"),
        TextBlock.fromString("2.1.1b"),
        TextBlock.fromString("2.1.1c")
    ]
);



describe("TextTable", () => {

    describe("static", () => {

        describe("create()", () => {

            it("fails when the column header array size is zero", () => {
                const tree = new Tree<TextBlock[]>();
                const n1 = tree.insert(undefined, undefined, [TextBlock.fromString("1"), TextBlock.fromString("1a")]);
                const res = TreeTable.create([], tree);
                expect(res.failed).toBeTrue();
            });


            it("fails when the column header array size is different than the tree data array size", () => {
                const tree = new Tree<TextBlock[]>();
                const n1 = tree.insert(undefined, undefined, [TextBlock.fromString("1"), TextBlock.fromString("1a")]);
                const headers = [TextBlock.fromString("tree"), TextBlock.fromString("a"), TextBlock.fromString("b")];
                const res = TreeTable.create(headers, tree);
                expect(res.failed).toBeTrue();
            });


            it("succeeds when the column header array size matches the tree data array size", () => {
                const tree = new Tree<TextBlock[]>();
                const n1 = tree.insert(undefined, undefined, [TextBlock.fromString("1"), TextBlock.fromString("1a"), TextBlock.fromString("1b")]);
                const headers = [TextBlock.fromString("tree"), TextBlock.fromString("a"), TextBlock.fromString("a")];
                const res = TreeTable.create(headers, tree);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.numRows).toEqual(2);
                expect(res.value!.numCols).toEqual(3);
            });
        });

    });


    describe("instance", () => {

        describe("toTextBlock()", () => {

            it("returns the expected TextBlock when all values are a single line", () => {
                const colHeaders = [
                    TextBlock.fromString("Name"),
                    TextBlock.fromString("Col A"),
                    TextBlock.fromString("Col B")
                ];

                const toTb = (str: string) => TextBlock.fromString(str);

                const tree = new Tree<Array<TextBlock>>();
                const n1     = tree.insert(undefined, undefined, [toTb("1"),     toTb("1A"),     toTb("1B")]);
                const n1n1   = tree.insert(n1,        undefined, [toTb("1.1"),   toTb("1.1A"),   toTb("1.1B")]);
                const n1n1n1 = tree.insert(n1n1,      undefined, [toTb("1.1.1"), toTb("1.1.1A"), toTb("1.1.1B")]);
                const n1n1n2 = tree.insert(n1n1,      undefined, [toTb("1.1.2"), toTb("1.1.2A"), toTb("1.1.2B")]);
                const n1n2   = tree.insert(n1,        undefined, [toTb("1.2"),   toTb("1.2A"),   toTb("1.2B")]);
                const n2     = tree.insert(undefined, undefined, [toTb("2"),     toTb("2A"),     toTb("2B")]);

                const resTable = TreeTable.create(colHeaders, tree);
                expect(resTable.succeeded).toBeTrue();
                const tb = resTable.value!.toTextBlock();
                expect(tb.lines.map((l) => stripAnsi(l))).toEqual(
                    // " Name             Col A    Col B  "
                    [
                        "Name            Col A   Col B ",
                        "├─ 1            1A      1B    ",
                        "│  ├─ 1.1       1.1A    1.1B  ",
                        "│  │  ├─ 1.1.1  1.1.1A  1.1.1B",
                        "│  │  └─ 1.1.2  1.1.2A  1.1.2B",
                        "│  └─ 1.2       1.2A    1.2B  ",
                        "└─ 2            2A      2B    "
                    ]
                );
            });


            it("returns the expected TextBlock when column headers contain multi-line values", () => {
                const colHeaders = [
                    TextBlock.fromString("Name\nName-Line2"),
                    TextBlock.fromString("Col A"),
                    TextBlock.fromString("Col B\nColB-Line2\nColB-Line3")
                ];

                const toTb = (str: string) => TextBlock.fromString(str);

                const tree = new Tree<Array<TextBlock>>();
                const n1     = tree.insert(undefined, undefined, [toTb("1"),     toTb("1A"),     toTb("1B")]);
                const n1n1   = tree.insert(n1,        undefined, [toTb("1.1"),   toTb("1.1A"),   toTb("1.1B")]);
                const n1n1n1 = tree.insert(n1n1,      undefined, [toTb("1.1.1"), toTb("1.1.1A"), toTb("1.1.1B")]);
                const n1n1n2 = tree.insert(n1n1,      undefined, [toTb("1.1.2"), toTb("1.1.2A"), toTb("1.1.2B")]);
                const n1n2   = tree.insert(n1,        undefined, [toTb("1.2"),   toTb("1.2A"),   toTb("1.2B")]);
                const n2     = tree.insert(undefined, undefined, [toTb("2"),     toTb("2A"),     toTb("2B")]);

                const resTable = TreeTable.create(colHeaders, tree);
                expect(resTable.succeeded).toBeTrue();
                const tb = resTable.value!.toTextBlock();
                expect(tb.lines.map((l) => stripAnsi(l))).toEqual(
                    // " Name             Col A    Col B  "
                    [
                        "                        Col B     ",
                        "Name                    ColB-Line2",
                        "Name-Line2      Col A   ColB-Line3",
                        "├─ 1            1A      1B        ",
                        "│  ├─ 1.1       1.1A    1.1B      ",
                        "│  │  ├─ 1.1.1  1.1.1A  1.1.1B    ",
                        "│  │  └─ 1.1.2  1.1.2A  1.1.2B    ",
                        "│  └─ 1.2       1.2A    1.2B      ",
                        "└─ 2            2A      2B        "
                    ]
                );
            });


            it("returns the expected TextBlock when column zero contains multi-line values", () => {
                const colHeaders = [
                    TextBlock.fromString("Name"),
                    TextBlock.fromString("Col A"),
                    TextBlock.fromString("Col B")
                ];

                const toTb = (str: string) => TextBlock.fromString(str);

                const tree = new Tree<Array<TextBlock>>();
                const n1     = tree.insert(undefined, undefined, [toTb("1\n1-line2"),     toTb("1A"),     toTb("1B")]);
                const n1n1   = tree.insert(n1,        undefined, [toTb("1.1"),   toTb("1.1A"),   toTb("1.1B")]);
                const n1n1n1 = tree.insert(n1n1,      undefined, [toTb("1.1.1\n1.1.1-line2"), toTb("1.1.1A"), toTb("1.1.1B")]);
                const n1n1n2 = tree.insert(n1n1,      undefined, [toTb("1.1.2"), toTb("1.1.2A"), toTb("1.1.2B")]);
                const n1n2   = tree.insert(n1,        undefined, [toTb("1.2"),   toTb("1.2A"),   toTb("1.2B")]);
                const n2     = tree.insert(undefined, undefined, [toTb("2"),     toTb("2A"),     toTb("2B")]);

                const resTable = TreeTable.create(colHeaders, tree);
                expect(resTable.succeeded).toBeTrue();
                const tb = resTable.value!.toTextBlock();
                expect(tb.lines.map((l) => stripAnsi(l))).toEqual(
                    // " Name             Col A    Col B  "
                    [
                        "Name                  Col A   Col B ",
                        "├─ 1                  1A      1B    ",
                        "│  1-line2                          ",
                        "│  ├─ 1.1             1.1A    1.1B  ",
                        "│  │  ├─ 1.1.1        1.1.1A  1.1.1B",
                        "│  │  │  1.1.1-line2                ",
                        "│  │  └─ 1.1.2        1.1.2A  1.1.2B",
                        "│  └─ 1.2             1.2A    1.2B  ",
                        "└─ 2                  2A      2B    "
                    ]
                );
            });

        });

    });

});
