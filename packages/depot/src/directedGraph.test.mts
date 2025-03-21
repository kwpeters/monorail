import { DirectedGraph, EdgeClassification, type IEdge } from "./directedGraph.mjs";


function getGraph1(): [Set<string>, Array<IEdge<string, string>>] {
    const vertices = new Set(["r", "s", "t", "u", "v", "w", "x", "y"]);
    const edges = [
        {fromVertex: "s", toVertex: "r", edgeAttr: "sr"},
        {fromVertex: "r", toVertex: "v", edgeAttr: "rv"},
        {fromVertex: "s", toVertex: "w", edgeAttr: "sw"},
        {fromVertex: "w", toVertex: "t", edgeAttr: "wt"},
        {fromVertex: "w", toVertex: "x", edgeAttr: "wx"},
        {fromVertex: "x", toVertex: "t", edgeAttr: "xt"},
        {fromVertex: "t", toVertex: "u", edgeAttr: "tu"},
        {fromVertex: "x", toVertex: "y", edgeAttr: "xy"},
        {fromVertex: "u", toVertex: "y", edgeAttr: "uy"},
    ];
    return [vertices, edges];
}


function getGraph2(): [Set<string>, Array<IEdge<string, string>>] {
    const vertices: Set<string> = new Set(["u", "v", "w", "x", "y", "z"]);
    const edges: Array<IEdge<string, string>> = [
        // Ordered to match Cormen p. 479.
        {fromVertex: "u", toVertex: "v", edgeAttr: "uv"},
        {fromVertex: "u", toVertex: "x", edgeAttr: "ux"},
        {fromVertex: "v", toVertex: "y", edgeAttr: "vy"},
        {fromVertex: "w", toVertex: "y", edgeAttr: "wy"},
        {fromVertex: "w", toVertex: "z", edgeAttr: "wz"},
        {fromVertex: "x", toVertex: "v", edgeAttr: "xv"},
        {fromVertex: "y", toVertex: "x", edgeAttr: "yx"},
        {fromVertex: "z", toVertex: "z", edgeAttr: "zz"}
    ];
    return [vertices, edges];
}


describe("DirectedGraph()", () => {
    describe("static", () => {
        describe("create()", () => {

            it("succeeds when given valid data", () => {
                const createRes = DirectedGraph.create(...getGraph1());
                expect(createRes.succeeded).toBeTrue();
            });


            it("fails when given invalid data (a vertex does not exist)", () => {
                const [vertices, edges] = getGraph1();
                const invalidEdges = edges.concat({fromVertex: "a", toVertex: "s", edgeAttr: "as"});
                const createRes = DirectedGraph.create(vertices, invalidEdges);
                expect(createRes.failed).toBeTrue();
                expect(createRes.error).toEqual('Edge specifies a fromVertex of "a" which is not in the vertex collection.');
            });
        });
    });


    describe("instance", () => {

        describe("vertices property", () => {

            it("contains the graphs's vertices", () => {
                const digraph = DirectedGraph.create(...getGraph1()).value!;
                expect(digraph.vertices).toEqual(new Set(["r", "s", "t", "u", "v", "w", "x", "y"]));
            });
        });


        describe("edges property", () => {

            it("contains the graph's edges", () => {
                const digraph = DirectedGraph.create(...getGraph1()).value!;
                expect(digraph.edges).toEqual([
                    { fromVertex: "r", toVertex: "v", edgeAttr: "rv" },
                    { fromVertex: "s", toVertex: "r", edgeAttr: "sr" },
                    { fromVertex: "s", toVertex: "w", edgeAttr: "sw" },
                    { fromVertex: "t", toVertex: "u", edgeAttr: "tu" },
                    { fromVertex: "u", toVertex: "y", edgeAttr: "uy" },
                    { fromVertex: "w", toVertex: "t", edgeAttr: "wt" },
                    { fromVertex: "w", toVertex: "x", edgeAttr: "wx" },
                    { fromVertex: "x", toVertex: "t", edgeAttr: "xt" },
                    { fromVertex: "x", toVertex: "y", edgeAttr: "xy" }
                ]);
            });
        });


        describe("breadthFirstSearch()", () => {

            it("returns the expected output", () => {
                const digraph = DirectedGraph.create(...getGraph1()).value!;
                const searchRes = digraph.breadthFirstSearch("s");
                expect(searchRes.succeeded).toBeTrue();
                const {distance, predecessor} = searchRes.value!;
                expect(distance).toEqual(new Map([
                    ["r", 1],
                    ["s", 0],
                    ["t", 2],
                    ["u", 3],
                    ["v", 2],
                    ["w", 1],
                    ["x", 2],
                    ["y", 3]
                ]));
                expect(predecessor).toEqual(new Map([
                    ["r", "s"],
                    ["s", undefined],
                    ["t", "w"],
                    ["u", "t"],
                    ["v", "r"],
                    ["w", "s"],
                    ["x", "w"],
                    ["y", "x"]
                ]));
            });


            it("fails when the source node does not exist in the graph", () => {
                const digraph = DirectedGraph.create(...getGraph1()).value!;
                const searchRes = digraph.breadthFirstSearch("a");
                expect(searchRes.failed).toBeTrue();
            });
        });


        describe("depthFirstSearch()", () => {

            it("returns the expected result", () => {
                const digraph = DirectedGraph.create(...getGraph2()).value!;
                const res = digraph.depthFirstSearch();
                expect(res.predecessor).toEqual(new Map([
                    ["u", undefined],
                    ["v", "u"],
                    ["w", undefined],
                    ["x", "y"],
                    ["y", "v"],
                    ["z", "w"],
                ]));
                expect(res.discoveryTimestamp).toEqual(new Map([
                    ["u", 1],
                    ["v", 2],
                    ["w", 9],
                    ["x", 4],
                    ["y", 3],
                    ["z", 10],
                ]));
                expect(res.finishTimestamp).toEqual(new Map([
                    ["u", 8],
                    ["v", 7],
                    ["w", 12],
                    ["x", 5],
                    ["y", 6],
                    ["z", 11],
                ]));
                expect(res.edgeClassification).toEqual(new Map([
                    ["u", [{toVertex: "v", edgeAttr: EdgeClassification.Tree}, {toVertex: "x", edgeAttr: EdgeClassification.Forward}]],
                    ["v", [{toVertex: "y", edgeAttr: EdgeClassification.Tree}]],
                    ["w", [{toVertex: "y", edgeAttr: EdgeClassification.Cross}, {toVertex: "z", edgeAttr: EdgeClassification.Tree}]],
                    ["x", [{toVertex: "v", edgeAttr: EdgeClassification.Back}]],
                    ["y", [{toVertex: "x", edgeAttr: EdgeClassification.Tree}]],
                    ["z", [{toVertex: "z", edgeAttr: EdgeClassification.Back}]]
                ]));
            });
        });
    });
});
