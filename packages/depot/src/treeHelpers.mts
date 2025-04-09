import { pipe } from "./pipe2.mjs";
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


    const treePaths = pipe(
        tree.leafNodePaths(),
        (iter) => Array.from(iter)
    );

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

        // While iterating over the nodes in the current tree path, if we
        // encounter a difference we want to stop duplicate checking for the
        // remainder of the nodes.  Start with dupe checking turned on.
        let doDupeCheck = true;

        for (let pathIndex = 0; pathIndex < curTreePath.length; pathIndex++) {
            if (!doDupeCheck) {
                // Duplicate checking is disabled for the remainder of the path.
                // Just put the current node into the row.
                outputRow.push(new SomeOption(curTreePath[pathIndex]!));
            }
            else {
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

                        // Since there was a difference, do not do duplicate checking for
                        // the remainder of the current path.
                        doDupeCheck = false;
                    }
                }
                else {
                    // The previous path does not have an entry at the current
                    // depth/level.  Just put the current node into the row.
                    outputRow.push(new SomeOption(curTreePath[pathIndex]!));

                    doDupeCheck = false;
                }
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
