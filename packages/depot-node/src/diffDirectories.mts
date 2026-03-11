import * as path from "node:path";
import { Stats } from "node:fs";
import { glob } from "glob";
import * as _ from "lodash-es";
import * as z from "zod";
import { assertNever } from "@repo/depot/never";
import { Directory } from "./directory.mjs";
import {File} from "./file.mjs";


export enum ActionPriority {
    /**
     * No action priority specified.  Give priority to preserving files.
     */
    Preserve   = "preserve",
    /**
     * Give priority to the left directory.
     */
    SyncLeftToRight = "sync left to right",
    /**
     * Give priority to the right directory.
     */
    SyncRightToLeft = "sync right to left"
}


export enum FileCompareActionType {
    CopyLeft    = "copy left",
    CopyRight   = "copy right",
    DeleteLeft  = "delete left",
    DeleteRight = "delete right",
    DeleteBoth  = "delete both",
    Skip        = "skip"
}


export class FileCompareAction {

    private readonly _files:      IFilesToCompare;
    private readonly _actionType: FileCompareActionType;

    public constructor(
        files: IFilesToCompare,
        actionType: FileCompareActionType
    ) {
        this._files      = files;
        this._actionType = actionType;
    }


    public get type(): FileCompareActionType {
        return this._actionType;
    }


    /**
     * Performs this action.
     * @return A promise that is resolved when the action has completed
     *     successfully or rejects if it failed.
     */
    public execute(): Promise<void> {
        switch (this._actionType) {
            case FileCompareActionType.CopyLeft:
                return this._files.rightFile.copy(this._files.leftFile)
                .then(() => { return; });

            case FileCompareActionType.CopyRight:
                return this._files.leftFile.copy(this._files.rightFile)
                .then(() => { return; });

            case FileCompareActionType.DeleteLeft:
                return this._files.leftFile.delete();

            case FileCompareActionType.DeleteRight:
                return this._files.rightFile.delete();

            case FileCompareActionType.DeleteBoth:
                return Promise.all(
                    [
                        this._files.leftFile.delete(),
                        this._files.rightFile.delete()
                    ]
                )
                .then(() => { return; });

            case FileCompareActionType.Skip:
                return Promise.resolve();

            default:
                assertNever(this._actionType);
        }
    }
}

export interface IFilesToCompare {
    leftFile:  File;
    rightFile: File;
    actions(actionPriority: ActionPriority): Promise<Array<FileCompareAction>>;
}


export class FileComparer implements IFilesToCompare {
    public static create(leftFile: File, rightFile: File): FileComparer {
        return new FileComparer(leftFile, rightFile);
    }


    // #region Data Members
    private readonly _leftFile:  File;
    private readonly _rightFile: File;
    // #endregion


    private constructor(leftFile: File, rightFile: File) {
        this._leftFile = leftFile;
        this._rightFile = rightFile;
    }


    public get leftFile(): File {
        return this._leftFile;
    }


    public get rightFile(): File {
        return this._rightFile;
    }


    public async isLeftOnly(): Promise<boolean> {
        const [leftExists, rightExists] = await Promise.all([
            this._leftFile.exists(),
            this._rightFile.exists()
        ]);

        return !!(leftExists && !rightExists);
    }


    public async isRightOnly(): Promise<boolean> {
        const [leftExists, rightExists] = await Promise.all([
            this._leftFile.exists(),
            this._rightFile.exists()
        ]);

        return !!(!leftExists && rightExists);
    }


    public async isInBoth(): Promise<boolean> {
        const [leftExists, rightExists] = await Promise.all([
            this._leftFile.exists(),
            this._rightFile.exists()
        ]);

        return !!(leftExists && rightExists);
    }


    public async bothExistAndIdentical(): Promise<boolean> {
        return filesAreIdentical(this._leftFile, undefined, this._rightFile, undefined);
    }


    public async actions(actionPriority: ActionPriority): Promise<Array<FileCompareAction>> {

        const [leftStats, rightStats] = await Promise.all([
            this._leftFile.exists(),
            this._rightFile.exists()
        ]);

        const isLeftOnly = !!(leftStats && !rightStats);
        const isRightOnly = !!(!leftStats && rightStats);
        const isInBoth = !!(leftStats && rightStats);

        const actions: Array<FileCompareAction> = [];

        if (isLeftOnly) {
            switch (actionPriority) {
                case ActionPriority.SyncLeftToRight:
                    actions.push(new FileCompareAction(this, FileCompareActionType.CopyRight));
                    actions.push(new FileCompareAction(this, FileCompareActionType.Skip));
                    actions.push(new FileCompareAction(this, FileCompareActionType.DeleteLeft));
                    break;

                case ActionPriority.SyncRightToLeft:
                    actions.push(new FileCompareAction(this, FileCompareActionType.DeleteLeft));
                    actions.push(new FileCompareAction(this, FileCompareActionType.Skip));
                    actions.push(new FileCompareAction(this, FileCompareActionType.CopyRight));
                    break;

                case ActionPriority.Preserve:
                    // No action priority specified.  Give priority to preserving
                    // files.
                    actions.push(new FileCompareAction(this, FileCompareActionType.CopyRight));
                    actions.push(new FileCompareAction(this, FileCompareActionType.Skip));
                    actions.push(new FileCompareAction(this, FileCompareActionType.DeleteLeft));
                    break;

                default:
                    assertNever(actionPriority);
            }
        }
        else if (isRightOnly) {
            switch (actionPriority) {
                case ActionPriority.SyncLeftToRight:
                    actions.push(new FileCompareAction(this, FileCompareActionType.DeleteRight));
                    actions.push(new FileCompareAction(this, FileCompareActionType.Skip));
                    actions.push(new FileCompareAction(this, FileCompareActionType.CopyLeft));
                    break;

                case ActionPriority.SyncRightToLeft:
                    actions.push(new FileCompareAction(this, FileCompareActionType.CopyLeft));
                    actions.push(new FileCompareAction(this, FileCompareActionType.Skip));
                    actions.push(new FileCompareAction(this, FileCompareActionType.DeleteRight));
                    break;

                case ActionPriority.Preserve:
                    // No action priority specified.  Give priority to preserving
                    // files.
                    actions.push(new FileCompareAction(this, FileCompareActionType.CopyLeft));
                    actions.push(new FileCompareAction(this, FileCompareActionType.Skip));
                    actions.push(new FileCompareAction(this, FileCompareActionType.DeleteRight));
                    break;

                default:
                    assertNever(actionPriority);
            }
        }
        else if (isInBoth) {

            const filesIdentical = await filesAreIdentical(this._leftFile, leftStats, this._rightFile, rightStats);

            if (filesIdentical) {
                // When the files are identical, there should be no actions.
            }
            else if (actionPriority === ActionPriority.SyncLeftToRight) {
                actions.push(new FileCompareAction(this, FileCompareActionType.CopyRight));
                actions.push(new FileCompareAction(this, FileCompareActionType.Skip));
                actions.push(new FileCompareAction(this, FileCompareActionType.CopyLeft));
                actions.push(new FileCompareAction(this, FileCompareActionType.DeleteBoth));
            }
            else if (actionPriority === ActionPriority.SyncRightToLeft) {
                actions.push(new FileCompareAction(this, FileCompareActionType.CopyLeft));
                actions.push(new FileCompareAction(this, FileCompareActionType.Skip));
                actions.push(new FileCompareAction(this, FileCompareActionType.CopyRight));
                actions.push(new FileCompareAction(this, FileCompareActionType.DeleteBoth));
            }
            else {
                // No action priority specified.  Give priority to preserving
                // files.
                actions.push(new FileCompareAction(this, FileCompareActionType.CopyRight));
                actions.push(new FileCompareAction(this, FileCompareActionType.CopyLeft));
                actions.push(new FileCompareAction(this, FileCompareActionType.Skip));
                actions.push(new FileCompareAction(this, FileCompareActionType.DeleteBoth));
            }
        }

        return actions;
    }

}


async function filesAreIdentical(
    leftFile: File,
    leftStats: Stats | undefined,
    rightFile: File,
    rightStats: Stats | undefined
): Promise<boolean> {

    if (leftStats === undefined || rightStats === undefined) {
        [leftStats, rightStats] = await Promise.all([leftFile.exists(), rightFile.exists()]);
    }

    if (leftStats === undefined || rightStats === undefined) {
        return false;
    }

    if (leftStats.size !== rightStats.size) {
        return false;
    }

    // if (leftStats.mtimeMs !== rightStats.mtimeMs) {
    //     return false;
    // }

    const [leftHash, rightHash] = await Promise.all([leftFile.getHash(), rightFile.getHash()]);
    if (leftHash !== rightHash) {
        return false;
    }

    // If we made it this far, they must be equal.
    return true;
}


////////////////////////////////////////////////////////////////////////////////

// eslint-disable-next-line @typescript-eslint/naming-convention
export const DiffDirFileStatus = {
    neitherExist: "neitherExist",
    leftOnly:     "leftOnly",
    rightOnly:    "rightOnly",
    identical:    "identical",
    different:    "different"
} as const;
export const schemaDiffDirFileStatus = z.enum(DiffDirFileStatus);
export type DiffDirFileStatus = z.infer<typeof schemaDiffDirFileStatus>;
// Enumerating values of DiffDirFileStatus:
//     for (const cur of Object.values(DiffDirFileStatus)) {}
//     for (const cur of schemaDiffDirFileStatus.options) {}


/**
 * A type representing a valid key in the DiffDirFileStatus enumeration.
 * Useful when creating mapped types.  For example:
 *     export type DiffDirFileStatusCounts = {
 *         [K in DiffDirFileStatusKey]: number;
 *     };
 */
export type DiffDirFileStatusKey = keyof typeof DiffDirFileStatus;


/**
 * Gets the key name for a given DiffDirFileStatus value.  Useful when indexing
 * into a type (probably a mapped type) that has the same keys as
 * DiffDirFileStatus.
 *
 * @param diffDirFileStatus - The DiffDirFileStatus to find the key of
 * @return The key that corresponds to the specified DiffDirFileStatus.
 */
export function diffDirFileStatusKey(diffDirFileStatus: DiffDirFileStatus): DiffDirFileStatusKey {
    for (const [key, val] of Object.entries(DiffDirFileStatus)) {
        if (val === diffDirFileStatus) {
            return key as DiffDirFileStatusKey;
        }
    }

    // Should never happen, but just in case...
    throw new Error(`Failed to find key for DiffDirFileStatus "${diffDirFileStatus}".`);
}


////////////////////////////////////////////////////////////////////////////////


export class DiffDirFileItem {
    /**
     * Creates a new instance.
     * @param leftRootDir - The left directory being compared
     * @param rightRootDir - The right directory being compared
     * @param relativeFilePath - The relative file path (to the directory being
     *     compared)
     * @param actionPriority - The overall action being performed so that the
     *     actions associated with this file item can be prioritized
     * @return A newly created DiffDirFileItem instance
     */
    public static create(
        leftRootDir:      Directory,
        rightRootDir:     Directory,
        relativeFilePath: string
    ): DiffDirFileItem {
        // The relative file path must be legit.
        if (relativeFilePath.length === 0) {
            throw new Error(`DiffDirFileItem relative file path cannot be 0-length.`);
        }

        const leftFile = new File(leftRootDir, relativeFilePath);
        const rightFile = new File(rightRootDir, relativeFilePath);

        return new DiffDirFileItem(
            leftRootDir,
            rightRootDir,
            relativeFilePath,
            FileComparer.create(leftFile, rightFile)
        );
    }


    // #region Data Members
    private readonly _leftRootDir:      Directory;
    private readonly _rightRootDir:     Directory;
    private readonly _relativeFilePath: string;
    private readonly _files:            IFilesToCompare;
    // #endregion


    private constructor(
        leftRootDir:           Directory,
        rightRootDir:          Directory,
        relativeFilePath:      string,
        files:                 IFilesToCompare
    ) {
        this._leftRootDir           = leftRootDir;
        this._rightRootDir          = rightRootDir;
        this._relativeFilePath      = relativeFilePath;
        this._files                 = files;
    }


    public get leftRootDir(): Directory {
        return this._leftRootDir;
    }


    public get rightRootDir(): Directory {
        return this._rightRootDir;
    }


    public get relativeFilePath(): string {
        return this._relativeFilePath;
    }


    public get leftFile(): File {
        return this._files.leftFile;
    }


    public get rightFile(): File {
        return this._files.rightFile;
    }


    public async isLeftOnly(): Promise<boolean> {
        const [leftExists, rightExists] = await Promise.all([
            this._files.leftFile.exists(),
            this._files.rightFile.exists()
        ]);

        return !!(leftExists && !rightExists);
    }


    public async isRightOnly(): Promise<boolean> {
        const [leftExists, rightExists] = await Promise.all([
            this._files.leftFile.exists(),
            this._files.rightFile.exists()
        ]);

        return !!(!leftExists && rightExists);
    }


    public async isInBoth(): Promise<boolean> {
        const [leftExists, rightExists] = await Promise.all([
            this._files.leftFile.exists(),
            this._files.rightFile.exists()
        ]);

        return !!(leftExists && rightExists);
    }


    public async bothExistAndIdentical(): Promise<boolean> {
        const [leftExists, rightExists] = await Promise.all([
            this._files.leftFile.exists(),
            this._files.rightFile.exists()
        ]);

        if (!leftExists || !rightExists) {
            // One or both of the files do not exist.
            return false;
        }

        // Both files exist.  Return a value indicating whether they are
        // identical.
        const [leftHash, rightHash] = await Promise.all([
            this._files.leftFile.getHash(),
            this._files.rightFile.getHash()
        ]);
        return leftHash === rightHash;
    }


    public async status(): Promise<DiffDirFileStatus> {
        const [leftExists, rightExists] = await Promise.all([
            this._files.leftFile.exists(),
            this._files.rightFile.exists()
        ]);

        if (leftExists && !rightExists) {
            return DiffDirFileStatus.leftOnly;
        }
        if (!leftExists && rightExists) {
            return DiffDirFileStatus.rightOnly;
        }
        if (leftExists && rightExists) {
            const identical = await this.bothExistAndIdentical();
            return identical ? DiffDirFileStatus.identical : DiffDirFileStatus.different;
        }

        return DiffDirFileStatus.neitherExist;

    }


    public actions(actionPriority: ActionPriority): Promise<Array<FileCompareAction>> {
        const actions = this._files.actions(actionPriority);
        return actions;
    }
}


export interface IDiffDirectoriesOptions {
    /** Whether to include files that exist only in the left directory in the
     * returned results. */
    includeLeftOnly:  boolean;
    /** Whether to include files that exist only in the right directory in the
     * returned results. */
    includeRightOnly: boolean;
    /** Whether to include files that are identical in both directories in the
     * returned results.  If true, identical files will be included with a
     * 0-length array of actions. */
    includeIdentical: boolean;
    /** Glob patterns specifying which files to include in the comparison.  If
     * not specified, all files are included. */
    includePatterns:  Array<string>;
    /** Glob patterns specifying which files to exclude from the comparison.  If
     * not specified, no files are excluded. */
    excludePatterns:  Array<string>;
}

const defaultDiffDirectoriesOptions: IDiffDirectoriesOptions = {
    includeLeftOnly:  true,
    includeRightOnly: true,
    includeIdentical: false,
    includePatterns:  ["**/*"],
    excludePatterns:  []
};


/**
 * Compares (recursively) the files within two directories.
 * @param leftDir - The left directory to be compared
 * @param rightDir - The right directory to be compared
 * @param options - Options that control the behavior of the comparison
 * @return An array of items representing the differences found between
 *     `leftDir` and `rightDir`.
 */
export async function diffDirectories(
    leftDir: Directory,
    rightDir: Directory,
    options: Partial<IDiffDirectoriesOptions> = {}
): Promise<Array<DiffDirFileItem>> {
    const {
        includeLeftOnly,
        includeRightOnly,
        includeIdentical,
        includePatterns,
        excludePatterns
    } = { ...defaultDiffDirectoriesOptions, ...options };
    const [leftRelativeFilePaths, rightRelativeFilePaths] = await Promise.all([
        getRelativeFilePathsRecursively(leftDir, includePatterns, excludePatterns),
        getRelativeFilePathsRecursively(rightDir, includePatterns, excludePatterns)
    ]);

    // Combine the left and right files into a single array.
    let diffDirFileItems: Array<DiffDirFileItem> = [
        ...leftRelativeFilePaths.map(
            (curRelativeFilePath) => DiffDirFileItem.create(leftDir, rightDir, curRelativeFilePath)
        ),
        ...rightRelativeFilePaths.map(
            (curRelativeFilePath) => DiffDirFileItem.create(leftDir, rightDir, curRelativeFilePath)
        )
    ];

    // If a file exists in both left and right, we don't want it to be
    // represented twice.  So make the list unique based on the file's relative
    // path.
    diffDirFileItems = _.uniqBy(diffDirFileItems, (curDiffDirFileItem) => curDiffDirFileItem.relativeFilePath);

    if (!includeLeftOnly || !includeRightOnly) {
        const existenceValues = await Promise.all(
            diffDirFileItems.map(
                async (curDiffDirFileItem) => {
                    const [isLeftOnly, isRightOnly] = await Promise.all([
                        curDiffDirFileItem.isLeftOnly(),
                        curDiffDirFileItem.isRightOnly()
                    ]);

                    return {
                        isLeftOnly:  isLeftOnly,
                        isRightOnly: isRightOnly
                    };
                }
            )
        );

        diffDirFileItems = diffDirFileItems.filter((_, index) => {
            const existenceValue = existenceValues[index]!;

            // If we don't want left-only files and it is left-only, return false.
            if (!includeLeftOnly && existenceValue.isLeftOnly) {
                return false;
            }

            // If we don't want right-only files and it is right-only, return false.
            if (!includeRightOnly && existenceValue.isRightOnly) {
                return false;
            }

            return true;
        });
    }

    //
    // If not including identical files, remove them.
    //
    if (!includeIdentical) {
        const identicalPromises = diffDirFileItems
        .map((curDiffDirFileItem) => curDiffDirFileItem.bothExistAndIdentical());
        const isIdenticalValues = await Promise.all(identicalPromises);

        diffDirFileItems = diffDirFileItems
        .filter((_, index) => !isIdenticalValues[index]);
    }

    //
    // Sort the DiffDirFileItem instances so that left-only and right-only files
    // from the same directory will be next to each other.
    //
    diffDirFileItems = _.sortBy(diffDirFileItems, (curDiffDirFileItem) => curDiffDirFileItem.relativeFilePath);

    return diffDirFileItems;
}


async function getRelativeFilePathsRecursively(
    rootDir:         Directory,
    includePatterns: Array<string>,
    excludePatterns: Array<string>
): Promise<Array<string>> {
    try {
        const relativeFilePaths = await glob(includePatterns, {
            cwd:    rootDir.toString(),
            dot:    true,
            nodir:  true,
            ignore: excludePatterns
        });

        return relativeFilePaths.map((curPath) => path.normalize(curPath));
    }
    catch {
        return []; // Directory does not exist.
    }
}
