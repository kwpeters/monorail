import { Tree } from "./tree.mjs";
import { atOrDefault, hasIndex, toArray } from "./arrayHelpers.mjs";
import { type ElementType } from "./typeUtils.mjs";
import { inspect } from "./inspect.mjs";


/**
 * An enumeration of Unicode ascii art glyphs used to represent the
 * structure of a tree.
 *
 * @example
 * // To iterate over the values in this enumeration:
 * for (const curVal of Object.values(TreeGlyph)) {...}
 */
// Allow PascalCase so this object can look like its corresponding type.
// eslint-disable-next-line @typescript-eslint/naming-convention
export const TreeGlyph = {
    nonLastSibling:    "├─ ",
    lastSibling:       "└─ ",
    nextSiblingBridge: "│  ",
    nullSiblingBridge: "   "
} as const;


export type TreeGlyph = typeof TreeGlyph[keyof typeof TreeGlyph];


export function isTreeGlyph(other: unknown): other is TreeGlyph {
    if (typeof other !== "string") {
        return false;
    }

    const allowedValues = Array.from(Object.values(TreeGlyph)) as string[];
    const isValid = allowedValues.includes(other);
    return isValid;
}


export function assertTreeGlyph(other: unknown): asserts other is TreeGlyph {
    if (!isTreeGlyph(other)) {
        throw new Error(`Failed assertion.  "${inspect(other)}" is not a TreeGlyph.`);
    }
}


////////////////////////////////////////////////////////////////////////////////

export interface ITreeTableOptions {
    colHeaders: Array<string>;
}

////////////////////////////////////////////////////////////////////////////////

export function toTreeTable<T>(
    tree: Tree<T | Array<T>>,
    opts: ITreeTableOptions
): string {

    const srcTree = tree.map((val) => toArray(val));

    // const [numRows, numCols] = calcRowsAndCols(srcTree);
    //
    // // An empty row with the correct number of columns.
    // const row = new Array<string>(numCols).fill("");
    // const table = [] as Array<Array<string>>;
    // for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
    //     table.push(row.slice(0));
    // }

    let output = atOrDefault(opts.colHeaders, 0, "") + "\n";

    const paths = Array.from(srcTree.nodePathsDF());
    let prevPath: ElementType<typeof paths> = [];
    for (const curPath of paths) {

        for (let pathIndex = 0; pathIndex < curPath.length; pathIndex++) {

            const prevNode = hasIndex(prevPath, pathIndex) ? prevPath[pathIndex] : undefined;
            const curNode = curPath[pathIndex]!;

            if (curNode === prevNode) {
                // The current path is for some descendant of the previous path.
                // We need to insert some sort of extender.  The type of
                // extender is determined by whether or not the node has a next
                // sibling.
                const nextSibling = srcTree.nextSibling(curNode);
                const extender = nextSibling ? TreeGlyph.nextSiblingBridge : TreeGlyph.nullSiblingBridge;
                output += extender;
            }
            else {
                // The current path is not a descendant of the previous path.
                const nextSibling = srcTree.nextSibling(curNode);
                const treeGlyph = nextSibling ? TreeGlyph.nonLastSibling : TreeGlyph.lastSibling;
                const nodeValues = srcTree.value(curNode);
                const nodeText = nodeValues.at(0)?.toString() ?? "<undefined>";
                output += treeGlyph + nodeText;
            }
        }

        //
        // Move to the next path.
        //
        output += "\n";
        prevPath = curPath;
    }

    if (output.endsWith("\n")) {
        // Remove the trailing newline.
        output = output.slice(0, -1);
    }

    return output;
}


////////////////////////////////////////////////////////////////////////////////
// Helper Functions
////////////////////////////////////////////////////////////////////////////////

/**
 * Calculates the number of rows and columns needed for the tree table
 *
 * @param tree - The tree to analyze
 * @return A tuple containing the number of rows and columns
 */
// function calcRowsAndCols<T>(tree: Tree<T | Array<T>>): [number, number] {
//     let maxCols = 0;
//     let numNodes = 0;
//
//     for (const curNode of tree.traverseDF()) {
//         const values = toArray(tree.value(curNode));
//         if (values.length > maxCols) {
//             maxCols = values.length;
//         }
//         numNodes++;
//     }
//     return [numNodes, maxCols];
// }
