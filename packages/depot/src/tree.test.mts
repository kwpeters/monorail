import { Tree } from "./tree.mjs";


/**
 * tree1
 * ├─ 1
 * │  ├── 1.1
 * │  │   ├── 1.1.1
 * │  │   │   └── 1.1.1.1
 * │  │   └── 1.1.2
 * │  └── 1.2
 * │      └── 1.2.1
 * └─ 2
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


        describe("length", () => {

            it("returns 0 for an empty tree", () => {
                const tree = new Tree<string>();
                expect(tree.length).toEqual(0);
            });


            it("returns the expected size for a non empty tree", () => {
                expect(tree1.length).toEqual(8);
            });

        });


        describe("maxDepth", () => {

            it("returns the expected maximum depth", () => {
                const maxDepth = tree1.maxDepth;
                expect(maxDepth).toEqual(3);
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


        describe("isLeaf()", () => {

            it("returns false for non-leaf nodes", () => {
                const isLeaf = tree1.isLeaf(n1);
                expect(isLeaf).toBeFalse();
            });


            it("returns true for leaf nodes", () => {
                const isLeaf = tree1.isLeaf(n1n1n1n1);
                expect(isLeaf).toBeTrue();
            });

        });


        describe("childNodes()", () => {

            it("when there are no child nodes returns an empty array", () => {
                const tree = new Tree<string>();
                const n = tree.insert(undefined, undefined, "hello");
                expect(tree.childNodes(n)).toEqual([]);
            });


            it("returns the expected array of child nodes", () => {
                const [n1, n2] = tree1.childNodes(undefined);
                const [n1n1, n1n2] = tree1.childNodes(n1);
                const [n1n1n1, n1n1n2] = tree1.childNodes(n1n1);
                const [n1n1n1n1] = tree1.childNodes(n1n1n1);
                const [n1n2n1] = tree1.childNodes(n1n2);

                expect(tree1.value(n1!)).toEqual("1");
                expect(tree1.value(n1n1!)).toEqual("1.1");
                expect(tree1.value(n1n1n1!)).toEqual("1.1.1");
                expect(tree1.value(n1n1n1n1!)).toEqual("1.1.1.1");
                expect(tree1.value(n1n1n2!)).toEqual("1.1.2");
                expect(tree1.value(n1n2!)).toEqual("1.2");
                expect(tree1.value(n1n2n1!)).toEqual("1.2.1");
                expect(tree1.value(n2!)).toEqual("2");
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


        describe("ancestors()", () => {

            it("iterates over the expected nodes when including the starting node", () => {
                const ancestors = Array.from(tree1.ancestors(n1n1n1n1, true));
                expect(ancestors).toEqual([n1n1n1n1, n1n1n1, n1n1, n1]);
            });


            it("iterates over the expected nodes when excluding the starting node", () => {
                const ancestors = Array.from(tree1.ancestors(n1n1n1n1, false));
                expect(ancestors).toEqual([n1n1n1, n1n1, n1]);
            });

        });


        describe("map()", () => {

            it("when the map is empty the fn is not called and the output map is empty", () => {

                let numInvocations = 0;
                const mapper = (str: string) => {
                    numInvocations++;
                    return str + "!";
                };

                const tree = new Tree<string>();
                const mapped = tree.map(mapper);
                expect(numInvocations).toEqual(0);
                expect(mapped.isEmpty()).toBeTrue();
            });


            it("returns a mapped version of the tree", () => {
                const mapped = tree1.map((val) => `${val}!`);

                const [n1, n2] = mapped.childNodes(undefined);
                const [n1n1, n1n2] = mapped.childNodes(n1);
                const [n1n1n1, n1n1n2] = mapped.childNodes(n1n1);
                const [n1n1n1n1] = mapped.childNodes(n1n1n1);
                const [n1n2n1] = mapped.childNodes(n1n2);

                expect(mapped.value(n1!)).toEqual("1!");
                expect(mapped.value(n1n1!)).toEqual("1.1!");
                expect(mapped.value(n1n1n1!)).toEqual("1.1.1!");
                expect(mapped.value(n1n1n1n1!)).toEqual("1.1.1.1!");
                expect(mapped.value(n1n1n2!)).toEqual("1.1.2!");
                expect(mapped.value(n1n2!)).toEqual("1.2!");
                expect(mapped.value(n1n2n1!)).toEqual("1.2.1!");
                expect(mapped.value(n2!)).toEqual("2!");
            });

        });


        describe("filter()", () => {

            it("returns the expected filtered version of the tree", () => {

                // Filter the tree to only keep nodes with a string of 3 or
                // fewer characters (e.g. "1.1").
                const filtered = tree1.filter((val) => val.length <= 3);

                /**
                 * Expected filtered
                 * ├─ 1
                 * │  ├── 1.1
                 * │  └── 1.2
                 * └─ 2
                 */
                const [n1, n2] = filtered.childNodes(undefined);
                const [n1n1, n1n2] = filtered.childNodes(n1);

                expect(filtered.length).toEqual(4);
                expect(n1).toBeDefined();
                expect(n1n1).toBeDefined();
                expect(n1n2).toBeDefined();
                expect(n2).toBeDefined();
            });

        });


        describe("toArchy()", () => {

            it("generates the expected object", () => {
                const tree = new Tree<string>();
                const n1 = tree.insert(undefined, undefined, "1");
                const n1n1 = tree.insert(n1, undefined, "1.1");
                const n1n1n1 = tree.insert(n1n1, undefined, "1.1.1");
                const n1n1n2 = tree.insert(n1n1, undefined, "1.1.2");
                const n2 = tree.insert(undefined, undefined, "2");
                const n3 = tree.insert(undefined, undefined, "3");
                const archy = tree.toArchy("tree", (payload) => payload + "!");
                expect(archy).toEqual(
                    {
                        label: "tree",
                        nodes: [
                            {
                                label: "1!",
                                nodes: [
                                    {
                                        label: "1.1!",
                                        nodes: [
                                            { label: "1.1.1!" },
                                            { label: "1.1.2!" }
                                        ]
                                    }
                                ]
                            },
                            { label: "2!" },
                            { label: "3!" }
                        ]
                    }
                );
            });

        });

    });

});
