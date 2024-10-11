import * as semver from "semver";


//
// The string that is prefixed onto version strings.
//
const VERSION_STRING_PREFIX = "v";


export class SemVer {

    public static sort(arr: Array<SemVer>): Array<SemVer> {
        return arr.sort((semverA, semverB) => {
            return semver.compare(semverA._semver, semverB._semver);
        });
    }

    public static fromString(str: string): SemVer | undefined {
        const sv = semver.parse(str);
        return sv ? new SemVer(sv) : undefined;
    }


    // region Data Members
    private readonly _semver: semver.SemVer;
    // endregion


    private constructor(semver: semver.SemVer) {
        this._semver = semver;
    }


    /**
     * Gets the major version number
     */
    public get major(): number {
        return this._semver.major;
    }


    /**
     * Gets the minor version number
     */
    public get minor(): number {
        return this._semver.minor;
    }


    /**
     * Gets the patch version number
     */
    public get patch(): number {
        return this._semver.patch;
    }


    // public get prerelease(): {type: string, version?: number} {
    public get prerelease(): ReadonlyArray<string | number> {
        return this._semver.prerelease;
    }


    /**
     * Returns this version as a string (no prefixes)
     * @return A string representation of this version
     */
    public toString(): string {
        return this._semver.toString();
    }


    /**
     * Gets this version as a version string (prefixed), including only the
     * major version number.
     * @return The major version string (prefixed)
     */
    public getMajorVersionString(): string {
        return `${VERSION_STRING_PREFIX}${this._semver.major}`;
    }


    /**
     * Gets this version as a version string (prefixed), including major and
     * minor version numbers.
     * @return The minor version string (prefixed)
     */
    public getMinorVersionString(): string {
        return `${VERSION_STRING_PREFIX}${this._semver.major}.${this._semver.minor}`;
    }


    /**
     * Gets this version as a version string (prefixed), including major, minor
     * and patch version numbers.
     * @return The patch version string (prefixed)
     */
    public getPatchVersionString(): string {
        return `${VERSION_STRING_PREFIX}${this._semver.major}.${this._semver.minor}.${this._semver.patch}`;
    }


    /**
     * Compares this version with other and determines whether the this version
     * is less, greater or equal to other.
     * @param other - The other version to compare to
     * @return -1 if this version is less than other. 1 if this version is
     * greater than other.  0 if this version equals other.
     */
    public compare(other: SemVer): -1 | 0 | 1 {
        return semver.compare(this._semver, other._semver);
    }

}
