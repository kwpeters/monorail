import { mapAsync } from "../../../packages/depot/src/promiseHelpers.js";
import { padLeft } from "../../../packages/depot/src/stringHelpers.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { Datestamp } from "./datestamp.js";
import { ConfidenceLevel, DatestampDeduction} from "./datestampDeduction.js";
import { DatestampDeductionAggregate } from "./datestampDeductionAggregate.js";


/**
 * A function that attempts to deduce the datestamp associated with the
 * specified file.
 * @param source - The file to analyze.
 * @return A promise that always resolves with a deduction result
 * (indicating success or failure).
 */
type IDatestampStrategy = (source: File, destDir: Directory) => Promise<DatestampDeduction>;

// TODO: Implement an _exif_ strategy.


const dateRegex = /(?<date>(?<year>(?:20|19)\d\d)(?:[-_])?(?<month>[01]\d)(?:[-_])?(?<day>[0123]\d))/;


export function datestampStrategyFilePath(source: File, destDir: Directory): Promise<DatestampDeduction> {
    const absPath = source.absPath();

    const matchResult = absPath.match(dateRegex);
    if (!matchResult) {
        return Promise.resolve({
            confidence:  ConfidenceLevel.NoClue,
            explanation: `The file path '${absPath}' does not contain a datestamp.`
        });
    }

    const dateStr = matchResult.groups!.date;
    const yearStr = matchResult.groups!.year;
    const monthStr = matchResult.groups!.month;
    const dayStr = matchResult.groups!.day;

    const datestampResult = Datestamp.fromStrings(yearStr, monthStr, dayStr);
    if (datestampResult.failed) {
        throw new Error(`Failed to instantiate Datestamp: ${datestampResult.error}`);
    }

    const datestamp = datestampResult.value;

    // Old destination file path where there is no month directory.
    // const dest = new File(destDir, datestamp.year.toString(), datestamp.toString(), source.fileName);

    const destFile = new File(
        destDir,
        datestamp.year.toString(),
        padLeft(datestamp.month.toString(), "0", 2),
        datestamp.toString(),
        source.fileName
    );

    return Promise.resolve({
        confidence:  ConfidenceLevel.Medium,
        datestamp:   datestampResult.value,
        explanation: `The file path '${absPath}' contains the date '${dateStr}'.`,
        destFile
    });
}


export async function applyDatestampStrategies(
    source: File,
    destDir: Directory,
    strategies: Array<IDatestampStrategy>
): Promise<DatestampDeductionAggregate> {
    const allDeductions = await mapAsync(strategies, (curStrategy) => curStrategy(source, destDir));

    const aggregateDeduction = new DatestampDeductionAggregate();
    for (const curResult of allDeductions) {
        aggregateDeduction.push(curResult);
    }
    return aggregateDeduction;
}
