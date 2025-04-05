import { Tree } from "./tree.mjs";


fdescribe("Tree", () => {

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
                expect(nextSibling).toBeDefined();
                expect(tree.value(nextSibling!)).toEqual("2");
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


        describe("advanceDF", () => {

            it("when the specified node has a child, a next sibling and a parent the child is returned", () => {
                const tree = new Tree<string>();
                const parent = tree.insert(undefined, undefined, "1");
                const node = tree.insert(parent, undefined, "1.1");
                const sib = tree.insert(parent, undefined, "1.2");
                const child = tree.insert(node, undefined, "1.1.1");

                const next = tree.advanceDF(node);
                expect(next).toEqual(child);
            });


            it("when the specified node has a next sibling and a parent the next sibling is returned", () => {
                const tree = new Tree<string>();
                const parent = tree.insert(undefined, undefined, "1");
                const node = tree.insert(parent, undefined, "1.1");
                const sib = tree.insert(parent, undefined, "1.2");

                const next = tree.advanceDF(node);
                expect(next).toEqual(sib);
            });


            it("when the specified node has no child or next sibling returns the closest ancestor sibling", () => {
                const tree = new Tree<string>();
                const parent = tree.insert(undefined, undefined, "1");
                const parentSib = tree.insert(undefined, undefined, "2");
                const node = tree.insert(parent, undefined, "1.1");

                const next = tree.advanceDF(node);
                expect(next).toEqual(parentSib);
            });

        });


        describe("traverseDF()", () => {

            it("traverses the nodes in the expected order", () => {
                const tree = new Tree<string>();
                const n1 = tree.insert(undefined, undefined, "1");
                const n1n1 = tree.insert(n1, undefined, "1.1");
                const n1n1n1 = tree.insert(n1n1, undefined, "1.1.1");
                const n1n1n2 = tree.insert(n1n1, undefined, "1.1.2");
                const n1n2 = tree.insert(n1, undefined, "1.2");

                const nodes = Array.from(tree.traverseDF());
                expect(nodes).toEqual([n1, n1n1, n1n1n1, n1n1n2, n1n2]);
            });

        });




    });

});
