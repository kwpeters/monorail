import { Tree, type ITreeNode } from "./tree.mjs";
import { hasIndex } from "./arrayHelpers.mjs";
import { NoneOption, Option, SomeOption } from "./option.mjs";


/**
 * Converts _tree_ into a table where the table is an array of rows and each row
 * is an array of cells.
 *
 * @param tree - The tree to be converted
 * @return An array of rows, where each row is an array of Option values.  Each
 * Option value represents a cell in the table.  The Option is NoneOption if the
 * cell contains the same ITreeNode as the corresponding cell in the previous
 * row.  The Option is a SomeOption containing an ITreeNode if it is different
 * than the corresponding cell in the previous row.
 */
export function treeToTable<TPayload>(
    tree:    Tree<TPayload>
): Array<Array<Option<ITreeNode<TPayload>>>> {

    const treePaths = tree.leafNodePaths();

    const optTable: Array<Array<Option<ITreeNode<TPayload>>>> = [];
    let prevTreePath: Array<ITreeNode<TPayload>> = [];

    for (const curTreePath of treePaths) {

        //
        // We are starting a new row.
        //

        // Add a blank row to the output table.
        const outputRow: Array<Option<ITreeNode<TPayload>>> = [];

        //
        // Iterate over the nodes in the current tree path and map them into
        // _outputRow_.
        //
        for (let pathIndex = 0; pathIndex < curTreePath.length; pathIndex++) {

            if (hasIndex(prevTreePath, pathIndex)) {

                if (curTreePath[pathIndex] === prevTreePath[pathIndex]) {
                    // The current node is the same node as in the previous path.
                    // This is represented as a None value.
                    outputRow.push(NoneOption.get());

                    // Continue to do duplicate checking.
                }
                else {
                    // The current node is *not* the same as that in the previous path.
                    // Put the current node into the output table.
                    outputRow.push(new SomeOption(curTreePath[pathIndex]!));
                }
            }
            else {
                // The previous path does not have an entry at the current
                // depth/level.  Just put the current node into the row.
                outputRow.push(new SomeOption(curTreePath[pathIndex]!));
            }
        }

        //
        // We are finished processing the current tree path/row.
        //

        // Add the current output row to the output table.
        optTable.push(outputRow);

        // The current tree path will become the previous tree path for the next
        // row/iteration.
        prevTreePath = curTreePath;
    }

    return optTable;
}
