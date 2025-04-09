import { Tree } from "./tree.mjs";
import { SomeOption, NoneOption } from "./option.mjs";
import { treeToTable } from "./treeHelpers.mjs";


/**
 * tree1
 * ├─ 1
 * │  ├── 1.1
 * │  │   ├── 1.1.1
 * │  │   └── same
 * │  └── 1.2
 * │      └── same   // Same value, but unique node => no merging with above row
 * └─ 2
 *    └── 2.1
 *        └── 2.1.1
 */
const tree1 = new Tree<string>();
const n1 = tree1.insert(undefined, undefined, "1");
const n1n1 = tree1.insert(n1, undefined, "1.1");
const n1n1n1 = tree1.insert(n1n1, undefined, "1.1.1");
const n1n1n2 = tree1.insert(n1n1, undefined, "same");
const n1n2 = tree1.insert(n1, undefined, "1.2");
const n1n2n1 = tree1.insert(n1n2, undefined, "same");
const n2 = tree1.insert(undefined, undefined, "2");
const n2n1 = tree1.insert(n2, undefined, "2.1");
const n2n1n1 = tree1.insert(n2n1, undefined, "2.1.1");


describe("treeToTable()", () => {

    it("returns the expected table when all leaf nodes have the same depth", () => {
        const table = treeToTable(tree1);
        expect(table).toEqual(
            [
                [new SomeOption(n1), new SomeOption(n1n1), new SomeOption(n1n1n1)],
                [NoneOption.get(),   NoneOption.get(),     new SomeOption(n1n1n2)],
                // Even though the following path has the same *value* as the
                // previous path at the 3rd level (index 2), it should not be
                // counted as a duplicate (None value), because it is a
                // different node instance (that only coincidentally has the
                // same value).
                [NoneOption.get(),   new SomeOption(n1n2), new SomeOption(n1n2n1)],
                [new SomeOption(n2), new SomeOption(n2n1), new SomeOption(n2n1n1)]
            ]
        );
    });


    it("returns a table with varying row lengths when leaf nodes have varying depths", () => {
        //
        // tree
        // ├─ 1
        // ├─ 2
        // │  └─ 2.1
        // └─ 3
        //    ├─ 3.1
        //    │  └─ 3.1.1
        //    └─ 3.2
        const tree = new Tree<string>();
        const n1 = tree.insert(undefined, undefined, "1");
        const n2 = tree.insert(undefined, undefined, "2");
        const n2n1 = tree.insert(n2, undefined, "2.1");
        const n3 = tree.insert(undefined, undefined, "3");
        const n3n1 = tree.insert(n3, undefined, "3.1");
        const n3n1n1 = tree.insert(n3n1, undefined, "3.1.1");
        const n3n2 = tree.insert(n3, undefined, "3.2");

        const table = treeToTable(tree);

        expect(table).toEqual([
            [new SomeOption(n1)],
            [new SomeOption(n2), new SomeOption(n2n1)],
            [new SomeOption(n3), new SomeOption(n3n1),  new SomeOption(n3n1n1)],
            [NoneOption.get(),   new SomeOption(n3n2)]
        ]);
    });

});
