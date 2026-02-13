import express from "express";
import type { HttpSuccess, HttpError } from "@repo/depot/httpStatusCodes";


/**
 * Response body structure for error responses.
 */
export interface ErrorResponseBody<TErrDetails> {
    success:     false;
    errMsg:      string;
    errDetails?: TErrDetails;
}


/**
 * Response body structure for success responses. The success property is
 * merged with the provided value properties.
 */
export type SuccessResponseBody<TValue extends Record<string, unknown> & { success?: never }> = {
    success: true;
} & TValue;


/**
 * Sends an error response to the client.
 *
 * @param res - The Express response object
 * @param statusCode - HTTP status code for the error
 * @param errMsg - Human-readable error message
 * @param errDetails - Optional additional error details
 */
export function sendError<TErrDetails = undefined>(
    res: express.Response,
    statusCode: HttpError,
    errMsg: string,
    errDetails?: TErrDetails
): void {
    if (res.headersSent) {
        return;
    }
    const body: ErrorResponseBody<TErrDetails> = errDetails !== undefined
        ? {success: false, errMsg, errDetails}
        : {success: false, errMsg};
    res.status(statusCode).json(body);
}


/**
 * Sends a success response to the client.
 *
 * @param res - The Express response object
 * @param statusCode - HTTP status code for the success response
 * @param value - Optional payload to include in the response body
 */
export function sendSuccess<TValue extends Record<string, unknown> = Record<string, never>>(
    res: express.Response,
    statusCode: HttpSuccess,
    value?: TValue
): void {
    if (res.headersSent) {
        return;
    }
    const body = value !== undefined
        ? {...value, success: true}
        : {success: true};
    res.status(statusCode).json(body);
}
