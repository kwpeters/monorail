import { Tree } from "./tree.mjs";


/**
 * T
 *
 * 1
 * ├── 1.1
 * │   ├── 1.1.1
 * │   │   └── 1.1.1.1
 * │   └── 1.1.2
 * ├── 1.2
 * │   └── 1.2.1
 * 2
 */
const tree1 = new Tree<string>();
const n1 = tree1.insert(undefined, undefined, "1");
const n1n1 = tree1.insert(n1, undefined, "1.1");
const n1n1n1 = tree1.insert(n1n1, undefined, "1.1.1");
const n1n1n1n1 = tree1.insert(n1n1n1, undefined, "1.1.1.1");
const n1n1n2 = tree1.insert(n1n1, undefined, "1.1.2");
const n1n2 = tree1.insert(n1, undefined, "1.2");
const n1n2n1 = tree1.insert(n1n2, undefined, "1.2.1");
const n2 = tree1.insert(undefined, undefined, "2");


describe("Tree", () => {

    describe("instance", () => {

        describe("isEmpty()", () => {

            it("when the tree is empty returns true", () => {
                const tree = new Tree<string>();
                expect(tree.isEmpty()).toBeTrue();
            });


            it("when the tree is not empty returns false", () => {
                const tree = new Tree<string>();
                tree.insert(undefined, undefined, "1");
                expect(tree.isEmpty()).toBeFalse();
            });

        });


        describe("value()", () => {

            it("gets the value of the specified node", () => {
                const tree = new Tree<string>();
                const node = tree.insert(undefined, undefined, "1");
                expect(node).toBeDefined();
                expect(tree.value(node)).toEqual("1");
            });

        });


        describe("parent()", () => {

            it("when called with a top level node returns undefined", () => {
                const tree = new Tree<string>();
                const node = tree.insert(undefined, undefined, "1");
                expect(node).toBeDefined();

                const parent = tree.parent(node);
                expect(parent).toBeUndefined();
            });


            it("when called with a non top level node returns the expected parent node", () => {
                const tree = new Tree<string>();
                const n1 = tree.insert(undefined, undefined, "1");
                const n1n1 = tree.insert(n1, undefined, "1.1");

                const parent = tree.parent(n1n1);
                expect(parent).toBeDefined();
                expect(tree.value(parent!)).toEqual("1");
            });

        });


        describe("depth()", () => {

            it("for top level nodes returns 0", () => {
                const tree = new Tree<string>();
                const n1 = tree.insert(undefined, undefined, "1");
                const n1n1 = tree.insert(n1, undefined, "1.1");
                const n1n1n1 = tree.insert(n1n1, undefined, "1.1.1");

                expect(tree.depth(n1)).toEqual(0);
            });


            it("for non top level nodes returns the expected depth", () => {
                const tree = new Tree<string>();
                const n1 = tree.insert(undefined, undefined, "1");
                const n1n1 = tree.insert(n1, undefined, "1.1");
                const n1n1n1 = tree.insert(n1n1, undefined, "1.1.1");

                expect(tree.depth(n1n1)).toEqual(1);
                expect(tree.depth(n1n1n1)).toEqual(2);
            });

        });


        describe("firstChild()", () => {

            it("can get top level items", () => {
                const tree = new Tree<string>();
                const node = tree.insert(undefined, undefined, "1");
                expect(node).toBeDefined();

                const firstChild = tree.firstChild(undefined);
                expect(firstChild).toBeDefined();
                expect(tree.value(firstChild!)).toEqual("1");
            });

        });


        describe("prevSibling()", () => {

            it("when a first sibling is specified returns undefined", () => {
                const tree = new Tree<string>();
                const n1 = tree.insert(undefined, undefined, "1");
                const n2 = tree.insert(undefined, undefined, "2");

                const prevSibling = tree.prevSibling(n1);
                expect(prevSibling).toBeUndefined();
            });


            it("when a non first sibling is specified returns the previous sibling node", () => {
                const tree = new Tree<string>();
                const n1 = tree.insert(undefined, undefined, "1");
                const n2 = tree.insert(undefined, undefined, "2");

                const prevSibling = tree.prevSibling(n2);
                expect(prevSibling).toEqual(n1);
            });

        });


        describe("nextSibling()", () => {

            it("when a last sibling is specified returns undefined", () => {
                const tree = new Tree<string>();
                const n1 = tree.insert(undefined, undefined, "1");
                const n2 = tree.insert(undefined, undefined, "2");

                const nextSibling = tree.nextSibling(n2);
                expect(nextSibling).toBeUndefined();
            });


            it("when a non last sibling is specified returns the next sibling node", () => {
                const tree = new Tree<string>();
                const n1 = tree.insert(undefined, undefined, "1");
                const n2 = tree.insert(undefined, undefined, "2");

                const nextSibling = tree.nextSibling(n1);
                expect(nextSibling).toEqual(n2);
            });

        });


        describe("insert()", () => {

            it("when no parent is specified creates top level nodes", () => {
                const tree = new Tree<string>();
                const node = tree.insert(undefined, undefined, "1");
                expect(node).toBeDefined();
                expect(tree.parent(node)).toBeUndefined();

                const firstChild = tree.firstChild(undefined);
                expect(firstChild).toBeDefined();
                expect(tree.value(firstChild!)).toEqual("1");
                expect(tree.parent(firstChild!)).toBeUndefined();
            });


            it("when a parent is specified creates non top level nodes", () => {
                const tree = new Tree<string>();
                const n1 = tree.insert(undefined, undefined, "1");
                const n1n1 = tree.insert(n1, undefined, "1.1");
                const n1n2 = tree.insert(n1, undefined, "1.2");

                expect(tree.parent(n1n1)).toEqual(n1);
                expect(tree.parent(n1n2)).toEqual(n1);
            });

        });


        describe("traverseDF()", () => {

            it("can traverse the entire tree in the expected order", () => {
                const nodes = Array.from(tree1.traverseDF());
                expect(nodes).toEqual([n1, n1n1, n1n1n1, n1n1n1n1, n1n1n2, n1n2, n1n2n1, n2]);
            });


            it("when traversing a leaf node and excluding the root no nodes are yielded", () => {
                const nodes = Array.from(tree1.traverseDF(n1n1n2, false));
                expect(nodes).toEqual([]);
            });


            it("when traversing a leaf node and including the root only the root is yielded", () => {
                const nodes = Array.from(tree1.traverseDF(n1n1n2, true));
                expect(nodes).toEqual([n1n1n2]);
            });


            it("can traverse a subtree in the expected order while excluding the subtree root", () => {
                const nodes = Array.from(tree1.traverseDF(n1n1, false));
                expect(nodes).toEqual([n1n1n1, n1n1n1n1, n1n1n2]);
            });


            it("can traverse a subtree in the expected order while including the subtree root", () => {
                const nodes = Array.from(tree1.traverseDF(n1n1, true));
                expect(nodes).toEqual([n1n1, n1n1n1, n1n1n1n1, n1n1n2]);
            });

        });


        describe("traverseBF()", () => {

            it("can traverse the entire tree in the expected order", () => {
                const nodes = Array.from(tree1.traverseBF());
                expect(nodes).toEqual([n1, n2, n1n1, n1n2, n1n1n1, n1n1n2, n1n2n1, n1n1n1n1]);
            });


            it("when traversing a leaf node and excluding the start node no nodes are yielded", () => {
                const nodes = Array.from(tree1.traverseBF(n1n1n2, false));
                expect(nodes).toEqual([]);
            });


            it("when traversing a leaf node and including the start node only the start node is yielded", () => {
                const nodes = Array.from(tree1.traverseBF(n1n1n2, true));
                expect(nodes).toEqual([n1n1n2]);
            });


            it("can traverse a subtree in the expected order while excluding the subtree root", () => {
                const nodes = Array.from(tree1.traverseBF(n1n1, false));
                expect(nodes).toEqual([n1n1n1, n1n1n2, n1n1n1n1]);
            });


            it("can traverse a subtree in the expected order while including the subtree root", () => {
                const nodes = Array.from(tree1.traverseBF(n1n1, true));
                expect(nodes).toEqual([n1n1, n1n1n1, n1n1n2, n1n1n1n1]);
            });

        });

    });

});
