//
// Bootstrap the app.  Use dynamic import to jump from this CommonJS module to
// an ESM module.
//
import("./main.mjs")
.then((mod) => {
    return mod.main();
})
.then((exitCode) => {
    if (exitCode !== 0) {
        process.exit(exitCode);
    }
})
.catch((err) => {
    console.error(JSON.stringify(err));
    process.exit(-1);
});
