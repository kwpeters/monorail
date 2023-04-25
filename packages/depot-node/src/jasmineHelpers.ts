import Jasmine = require("jasmine");


/**
 * Helper function that runs Jasmine and returns a promise that indicates the
 * results of the tests.
 * @param jasmineInstance - The jasmine instance to execute.
 * @return A promise that resolves when all tests pass and rejects when one or
 * more fail.  In either case, the promise does not settle until all tests have
 * completed.
 */
export async function runJasmine(jasmineInstance: Jasmine): Promise<void> {
    const result = await jasmineInstance.execute();
    if (result.overallStatus !== "passed") {
        throw new Error("One or more tests failed.");
    }

}
