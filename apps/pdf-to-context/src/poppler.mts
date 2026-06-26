import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { spawn, spawnErrorToString, isISpawnSystemError } from "@repo/depot-node/spawn2";
import { type File } from "@repo/depot-node/file";


/**
 * The set of Poppler operations the app needs.  Higher-level modules depend on
 * this interface (not the concrete implementation) so that unit tests can inject
 * fakes and avoid needing Poppler installed.
 */
export interface IPopplerFns {
    /** Gets the number of pages in the PDF (via `pdfinfo`). */
    getPageCount: (pdf: File) => Promise<Result<number, string>>;

    /**
     * Extracts layout-preserved UTF-8 text for pages [first, last] to stdout
     * (via `pdftotext`).  Pages are separated by form-feed (`\f`).
     */
    extractText: (pdf: File, first: number, last: number) => Promise<Result<string, string>>;

    /**
     * Renders pages [first, last] to PNG files named `<prefixPath>-<page>.png`
     * (via `pdftoppm`).  Resolves with the (empty) stdout on success.
     */
    renderImages: (
        pdf: File,
        first: number,
        last: number,
        dpi: number,
        prefixPath: string
    ) => Promise<Result<string, string>>;

    /** Dumps the PDF's bookmark outline as XML (via `pdftohtml -xml`). */
    dumpOutlineXml: (pdf: File) => Promise<Result<string, string>>;
}


/**
 * Runs a Poppler command-line tool, mapping any spawn failure to a string error.
 */
async function runTool(cmd: string, args: Array<string>): Promise<Result<string, string>> {
    const res = await spawn(cmd, args).closePromise;
    return Result.mapError(spawnErrorToString, res);
}


/**
 * The real Poppler implementation, backed by `@repo/depot-node/spawn2`.
 */
export const popplerFns: IPopplerFns = {
    getPageCount: async (pdf) => {
        const res = await runTool("pdfinfo", [pdf.absPath()]);
        return Result.bind(
            (stdout) => {
                const pages = /^Pages:\s+(?<pages>\d+)/m.exec(stdout)?.groups?.pages;
                return pages === undefined ?
                    new FailedResult(`Could not find page count in pdfinfo output for "${pdf.toString()}".`) :
                    new SucceededResult(parseInt(pages, 10));
            },
            res
        );
    },

    extractText: (pdf, first, last) => runTool(
        "pdftotext",
        ["-f", `${first}`, "-l", `${last}`, "-layout", "-enc", "UTF-8", pdf.absPath(), "-"]
    ),

    renderImages: (pdf, first, last, dpi, prefixPath) => runTool(
        "pdftoppm",
        ["-f", `${first}`, "-l", `${last}`, "-r", `${dpi}`, "-png", pdf.absPath(), prefixPath]
    ),

    dumpOutlineXml: (pdf) => runTool(
        "pdftohtml",
        ["-xml", "-f", "1", "-l", "1", "-stdout", pdf.absPath()]
    )
};


/**
 * Verifies that the specified command-line tools are resolvable on the PATH.
 * A tool is considered present if it can be spawned at all (even if it exits
 * non-zero); it is considered missing only on an ENOENT system error.
 *
 * @param tools - The tool names to check (e.g. "pdfinfo")
 * @returns A successful Result if all tools are present; otherwise a failed
 * Result naming the missing tool(s).
 */
export async function ensureToolsAvailable(tools: Array<string>): Promise<Result<void, string>> {
    const missing: Array<string> = [];
    for (const tool of tools) {
        const res = await spawn(tool, ["-v"]).closePromise;
        if (res.failed && isISpawnSystemError(res.error) && res.error.code === "ENOENT") {
            missing.push(tool);
        }
    }

    return missing.length === 0 ?
        new SucceededResult(undefined) :
        new FailedResult(
            `Required Poppler tool(s) not found on PATH: ${missing.join(", ")}. ` +
            `Install Poppler and ensure its "bin" directory is on the PATH.`
        );
}
