import * as cp from "node:child_process";


/**
 * Launches a child process and then detaches from it so that it will not prevent
 * this process from exiting.
 *
 * @param cmd - The command to execute
 * @param args - The command arguments
 * @param spawnOptions - Additional spawn options.
 */
export function launch(cmd: string, args: Array<string>, spawnOptions?: cp.SpawnOptions): void {

    // Setup default spawn options needed to launch a detached child process.
    let options: cp.SpawnOptions = {
        detached: true,
        // I/O streams must not be inherited to be disconnected from the parent process.
        stdio:    "ignore"
    };

    // If the caller has specified spawn options, use them.
    if (spawnOptions) {
        options = Object.assign(options, spawnOptions);
    }

    const childProc = cp.spawn(cmd, args, options);

    // Unreference the child process so that it will not prevent this process
    // from exiting.
    childProc.unref();
}
