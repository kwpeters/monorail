import * as _ from "lodash-es";
import winston from "winston";


const config = {
    // Highest severity
    error: {level: 0, color: "red"},
    warn:  {level: 1, color: "yellow"},
    info:  {level: 2, color: "green"},
    http:  {level: 3, color: "magenta"},
    debug: {level: 4, color: "white"}
    // Lowest severity
};

winston.addColors(_.mapValues(config, (val) => val.color));


function getLevel() {
    const env = process.env.NODE_ENV || "development";
    const isDevelopment = env === "development";

    // Show all debug and more severe messages in development mode.
    // Show warnings and more severe messages in production mode.
    return isDevelopment ? "debug" : "warn";
}


const formatFunc = winston.format.printf(function (props: winston.Logform.TransformableInfo): string {
    const timestamp = props.timestamp as string | undefined ?? "";
    const message = props.message as string | undefined ?? "";
    return `${timestamp} ${props.level} ${message} ${props.meta ? JSON.stringify(props.meta) : ""}`;
});

const consoleTransport = new winston.transports.Console(
    {
        level:            "debug",
        handleExceptions: true,
        format:           winston.format.combine(
            // Colorize the whole line, not just the severity label.
            winston.format.colorize({ all: true }),
            winston.format.timestamp(),
            winston.format.splat(),
            formatFunc
        )
    }
);
const errorFileTransport = new winston.transports.File(
    {
        filename:         "logs/error.log",
        handleExceptions: true,
        maxsize:          1024 * 1024, // 1 MB
        level:            "error",
        maxFiles:         5,
        tailable:         true, // enables rolling logs
        format:           winston.format.combine(
            // No colorizing in file output because it creates color control
            // sequences that make it hard to read.
            winston.format.timestamp(),
            winston.format.splat(),
            formatFunc
        )
    }
);

const allFileTransport = new winston.transports.File(
    {
        filename:         "logs/all.log",
        handleExceptions: true,
        maxsize:          1024 * 1024, // 1 MB
        level:            "debug",
        maxFiles:         5,
        tailable:         true, // enables rolling logs
        format:           winston.format.combine(
            // No colorizing in file output because it creates color control
            // sequences that make it hard to read.
            winston.format.timestamp(),
            winston.format.splat(),
            formatFunc
        )
    }
);

const transports = [
    consoleTransport,
    errorFileTransport,
    allFileTransport
];

export const logger = winston.createLogger({
    level:  getLevel(),
    levels: _.mapValues(config, (val) => val.level),
    transports
});
