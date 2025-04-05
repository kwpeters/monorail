
////////////////////////////////////////////////////////////////////////////////
// Tree Nodes
////////////////////////////////////////////////////////////////////////////////

interface ITreeRoot<TPayload> {
    isRoot:   true;
    // There is not parent node.
    // There is no payload for the root element.
    children: Array<ITreeNode<TPayload>>;
}

interface ITreeNode<TPayload> {
    isRoot:   false;
    parent:   TreeNode<TPayload>;
    payload:  TPayload;
    children: Array<ITreeNode<TPayload>>;
}

type TreeNode<TPayload> = ITreeRoot<TPayload> | ITreeNode<TPayload>;


////////////////////////////////////////////////////////////////////////////////

export interface IReadOnlyTree<TPayload> {
    value(node: ITreeNode<TPayload>): Readonly<TPayload>;
    parent(node: ITreeNode<TPayload>): Readonly<ITreeNode<TPayload>> | undefined;
    depth(node: ITreeNode<TPayload>): number;
    firstChild(parent: ITreeNode<TPayload> | undefined): Readonly<ITreeNode<TPayload>> | undefined;
    nextSibling(node: ITreeNode<TPayload>): Readonly<ITreeNode<TPayload>> | undefined;
}


export class Tree<TPayload> implements IReadOnlyTree<TPayload> {

    private readonly _root: ITreeRoot<TPayload>;


    public constructor() {
        this._root = { isRoot: true, children: [] };
    }


    /**
     * Gets the specified node's value
     *
     * @param node - The node whose value will be gotten
     * @return The specified node's value
     */
    public value(node: ITreeNode<TPayload>): TPayload {
        return node.payload;
    }


    /**
     * Gets the specified node's parent node
     *
     * @param node - The node whose parent will be found
     * @return The node's parent node or undefined if the specified node is a
     * top level node.
     */
    public parent(node: ITreeNode<TPayload>): ITreeNode<TPayload> | undefined {
        return node.parent.isRoot ? undefined : node.parent;
    }


    /**
     * Calculates the specified node's depth within this tree.  Top level nodes
     * have a depth of 0.
     *
     * @param node - The node to calculate the depth of
     * @return The node's depth
     */
    public depth(node: ITreeNode<TPayload>): number {
        let depth = -1;
        let curNode: TreeNode<TPayload> = node;
        while (!curNode.isRoot) {
            curNode = curNode.parent;
            depth++;
        }
        return depth;
    }


    /**
     * Gets the specified node's  first child node
     *
     * @param parent - The parent node whose first child will be found
     * @return The node's first child node or undefined if the node has no
     * children
     */
    public firstChild(parent: ITreeNode<TPayload> | undefined): ITreeNode<TPayload> | undefined {
        const parentNode = parent ?? this._root;
        const firstChild = parentNode.children.length === 0 ? undefined : parentNode.children[0];
        return firstChild;
    }


    /**
     * Gets the specified node's next sibling
     *
     * @param node - The node whose next sibling will be found
     * @return The next sibling node or undefined if there is no next sibling
     */
    public nextSibling(node: ITreeNode<TPayload>): ITreeNode<TPayload> | undefined {
        const parent = node.parent.isRoot ? this._root : node.parent;
        const foundIndex = parent.children.findIndex((curNode) => curNode === node);
        if (foundIndex >= 0) {
            if (foundIndex === parent.children.length - 1) {
                // The specified node is the last child.
                return undefined;
            }
            else {
                return parent.children[foundIndex + 1];
            }
        }
        else {
            // The child node could not be found under its parent.  This is an
            // internal implementation error.
            throw new Error("Child node could not be found in its parent's children array.");
        }

    }


    /**
     * Inserts a node into this tree
     *
     * @param parent - The node that will be the new node's parent.  undefined
     * if the new node should be a top level node.
     * @param insertBefore - The sibling node the new node will be inserted in
     * front of.  undefined if the new node is to be appended to the child
     * collection.
     * @param childVal - The value attached to the new node
     * @return The newly inserted node
     */
    public insert(
        parent: ITreeNode<TPayload> | undefined,
        insertBefore: ITreeNode<TPayload> | undefined,
        childVal: TPayload
    ): ITreeNode<TPayload> {
        const parentNode = parent ?? this._root;

        let insertionIndex: number;
        if (insertBefore === undefined) {
            // Append onto the end of the child array.
            insertionIndex = parentNode.children.length;
        }
        else {
            const foundIndex = parentNode.children.findIndex((n) => n === insertBefore);
            if (foundIndex >= 0) {
                insertionIndex = foundIndex;
            }
            else {
                throw new Error("Child node could not be found in its parent's children array.");
            }
        }

        const newChildNode = {
            isRoot:   false,
            parent:   parentNode,
            payload:  childVal,
            children: []
        } as ITreeNode<TPayload>;
        parentNode.children.splice(insertionIndex, 0, newChildNode);
        return newChildNode;
    }

}
