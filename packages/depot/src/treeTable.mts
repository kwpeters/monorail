// eslint-disable-next-line @typescript-eslint/naming-convention
import Table from "cli-table3";
import { Tree, type IReadonlyTree, type ITreeNode } from "./tree.mjs";
import { atOrDefault } from "./arrayHelpers.mjs";
import { inspect } from "./inspect.mjs";
import type { IHasToString } from "./primitives.mjs";
import { type ITextBlockPrefix, maxLines, TextBlock } from "./textBlock.mjs";
import { FailedResult, SucceededResult, type Result } from "./result.mjs";
import { pipe } from "./pipe2.mjs";
import { optionsNoLines } from "./cli-table3.mjs";

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


// TODO: Add an option to not link the first top-level item to the column header
// using └─ or ├─.  It should use ──  and ┌─.  This option should be called
// treeConnectsToHeader


export class TreeTable implements IHasToString {

    ////////////////////////////////////////////////////////////////////////////////
    // Static
    ////////////////////////////////////////////////////////////////////////////////

    public static create(
        colHeaders: readonly TextBlock[],
        tree: Tree<readonly TextBlock[]>
    ): Result<TreeTable, string> {

        //
        // Validate the inputs.
        //

        // There must be at least one column header.
        if (colHeaders.length === 0) {
            return new FailedResult("A TreeTable must have at least one column header.");
        }

        // The value associated with each tree node, must be an array of
        // TextBlocks that is the same size as the column header array.
        const numCols = colHeaders.length;
        for (const curNode of tree.traverseDF()) {
            const textBlocks = tree.value(curNode);
            if (textBlocks.length !== numCols) {
                return new FailedResult(`Tree node has ${textBlocks.length} columns but header row has ${numCols}.`);
            }
        }

        const inst = new TreeTable(colHeaders, tree);
        return new SucceededResult(inst);
    }


    /**
     * Creates a new tree in which column 0 contains Unicode characters that
     * draw the tree structure.
     *
     * @param tree - The tree to be decorated
     * @return A new tree that is identical to _tree_ except that the first
     *     TextBlock of each node's value array is prefixed with the the Unicode
     *     characters that are needed to draw the tree structure
     */
    private static addTreeLinesToColZero(tree: IReadonlyTree<readonly TextBlock[]>) {
        let prevPath: ITreeNode<readonly TextBlock[]>[] = [];
        tree = tree.map((textBlocks, srcNode, srcTree, dstParent, dstTree) => {

            const curPath = pipe(
                srcTree.ancestors(srcNode, true),
                (iterNodes) => Array.from(iterNodes),
                (nodes) => nodes.reverse()
            );

            const textBlockPrefixes: Array<ITextBlockPrefix> = [];

            curPath.forEach((curNode, idx) => {

                const prevNode = prevPath.at(idx);

                if (curNode === prevNode) {
                    // The current path is for some descendant of the previous path.
                    // We need to insert some sort of extender.  The type of
                    // extender is determined by whether or not the node has a next
                    // sibling.
                    const nextSibling = srcTree.nextSibling(curNode);

                    if (nextSibling) {
                        textBlockPrefixes.push({
                            first:  TreeGlyph.nextSiblingBridge,
                            middle: TreeGlyph.nextSiblingBridge,
                            last:   TreeGlyph.nextSiblingBridge
                        });
                    }
                    else {
                        textBlockPrefixes.push({
                            first:  TreeGlyph.nullSiblingBridge,
                            middle: TreeGlyph.nullSiblingBridge,
                            last:   TreeGlyph.nullSiblingBridge
                        });
                    }
                }
                else {
                    // The current path is not a descendant of the previous path.
                    const nextSibling = srcTree.nextSibling(curNode);
                    if (nextSibling) {
                        textBlockPrefixes.push({
                            first:  TreeGlyph.nonLastSibling,
                            middle: TreeGlyph.nextSiblingBridge,
                            last:   TreeGlyph.nextSiblingBridge
                        });
                    }
                    else {
                        textBlockPrefixes.push({
                            first:  TreeGlyph.lastSibling,
                            middle: TreeGlyph.nullSiblingBridge,
                            last:   TreeGlyph.nullSiblingBridge
                        });
                    }

                }
            });

            // Make the column zero TextBlock have the maximum number of lines
            // found in the row so that the prefixes get applied to all lines.
            // Also, when making the column zero TextBlock the maximum number of
            // lines, pad with a tree glyph that will connect to the child
            // nodes, if present.
            const numLines = maxLines(textBlocks);
            const padLine = srcTree.firstChild(srcNode) ? TreeGlyph.nextSiblingBridge : "";
            let curTextBlock = pipe(
                atOrDefault(textBlocks, 0, TextBlock.fromString("")),
                (tb) => tb.topJustify(numLines, padLine)
            );
            const reversedPrefixes = textBlockPrefixes.slice().reverse();
            for (const curPrefix of reversedPrefixes) {
                curTextBlock = curTextBlock.prefixLines(curPrefix);
            }

            const newTextBlocks = [curTextBlock, ...textBlocks.slice(1)];

            // Move to the next path.
            prevPath = curPath;

            return newTextBlocks;
        });
        return tree;
    }


    ////////////////////////////////////////////////////////////////////////////////
    // instance
    ////////////////////////////////////////////////////////////////////////////////

    private readonly _colHeaders: readonly TextBlock[];
    private readonly _tree:       IReadonlyTree<readonly TextBlock[]>;


    private constructor(colHeaders: readonly TextBlock[], tree: IReadonlyTree<readonly TextBlock[]>) {
        this._colHeaders = colHeaders;
        this._tree = tree;
    }


    public get tree(): IReadonlyTree<readonly TextBlock[]> {
        return this._tree;
    }


    public get numRows(): number {
        // There will be 1 header row plus one row for each node in the tree.
        return 1 + this._tree.length;
    }


    public get numCols(): number {
        // TODO: The following implementation is not accurate.  A tree node may
        // have more columns than what exists in the column headers.
        return this._colHeaders.length;
    }


    public toTextBlock(): TextBlock {

        const decoratedTree = TreeTable.addTreeLinesToColZero(this._tree);

        // Create the table instance with our options
        const table = new Table(optionsNoLines);

        // Add the column headers row.  Make sure each column header is bottom
        // justified.
        const rowHeight = maxLines(this._colHeaders);
        const colHeaders = this._colHeaders.map((tb) => tb.bottomJustify(rowHeight));
        table.push(colHeaders.map((tb) => tb.toString()));

        for (const curNode of decoratedTree.traverseDF(undefined, false)) {
            const textBlocks = decoratedTree.value(curNode);
            table.push(textBlocks.map((tb) => tb.toString()));
        }

        const tb = TextBlock.fromString(table.toString());
        return tb;
    }

}
