import { spawn } from "child_process";


/**
 * Launches a child process and then detaches from it so that it will not prevent
 * this process from exiting.
 *
 * @param cmd - The command to execute
 * @param args - The command arguments
 * @param cwd - The current working directory
 */
export function launch(cmd: string, args: Array<string>, cwd?: string): void {

    // TODO: Add the ability to set the shell option to true to use the shell
    // specified by the ComSpec environment variable.  Probably do this on
    // Windows only.

    const childProc = spawn(
        cmd,
        args,
        {
            detached: true,
            // I/O streams must not be inherited to be disconnected from the parent process.
            stdio:    "ignore",
            cwd:      cwd
        }
    );

    // Unreference the child process so that it will not prevent this process
    // from exiting.
    childProc.unref();
}
