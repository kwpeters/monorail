import express from "express";
import { z } from "zod";
import { safeParse } from "@repo/depot/zodHelpers";
import { HttpSuccess, HttpError } from "@repo/depot/httpStatusCodes";
import type { Result } from "@repo/depot/result";
import type { MaybePromise } from "@repo/depot/typeUtils";


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


////////////////////////////////////////////////////////////////////////////////

export interface IHandlerSuccess<TBody> {
    statusCode: HttpSuccess;
    body:       TBody;
}

export interface IHandlerError {
    statusCode: HttpError;
    message:    string;
    details?:   unknown;
}



/**
 * Handles an HTTP route by validating the request body, invoking a handler function,
 * and validating and sending the response body.
 *
 * @template TReqSchema - The Zod schema type for validating the request body
 * @template TResSchema - The Zod schema type for validating the response body
 *
 * @param req - The Express request object
 * @param reqBodySchema - Optional Zod schema to validate the request body. If undefined, no validation is performed.
 * @param res - The Express response object used to send the response
 * @param resBodySchema - Optional Zod schema to validate the response body. If undefined, no validation is performed.
 * @param handlerFn - The handler function that processes the request and returns a Result containing either success or error information
 *
 * @returns A promise that resolves when the response has been sent
 *
 * @example
 * ```typescript
 * const reqSchema = z.object({ name: z.string() });
 * const resSchema = z.object({ id: z.number(), name: z.string() });
 *
 * await handleRoute(
 *   req,
 *   reqSchema,
 *   res,
 *   resSchema,
 *   async (req, reqBody) => {
 *     return new SucceededResult({ statusCode: 200, body: { id: 1, name: reqBody.name } });
 *   }
 * );
 * ```
 *
 * @remarks
 * - If request body validation fails, a 400 Bad Request error is sent
 * - If the handler returns an error, the error response is sent with the specified status code
 * - If response body validation fails, a 500 Internal Server Error is sent
 * - If all validations pass, a success response is sent with the specified status code
 */
export async function handleRoute<
    TReqSchema extends z.ZodTypeAny,
    TResSchema extends z.ZodType<Record<string, unknown>>
>(
    req: express.Request,
    reqBodySchema: TReqSchema | undefined,
    res: express.Response,
    resBodySchema: TResSchema | undefined,
    handlerFn: (
        req:     express.Request,
        reqBody: TReqSchema extends z.ZodTypeAny ? z.infer<TReqSchema> : undefined
    ) => MaybePromise<Result<
        IHandlerSuccess<TResSchema extends z.ZodTypeAny ? z.infer<TResSchema> : undefined>,
        IHandlerError
    >>
): Promise<void> {

    let reqBody: unknown = undefined;
    if (reqBodySchema !== undefined) {
        // Validate the request body.
        const rValidateReq = safeParse(reqBodySchema, req.body as unknown);
        if (rValidateReq.failed) {
            // The request's body was invalid.  Return an error immediately.
            sendError(res, HttpError._400_BadRequest, "Invalid request body.", rValidateReq.error);
            return;
        }
        reqBody = rValidateReq.value;
    }

    // Invoke the handler function.
    const rHandler = await Promise.resolve(handlerFn(req, reqBody as never));


    if (rHandler.failed) {
        // The handler returned an error.  Send an error response containing the
        // error information.
        sendError(res, rHandler.error.statusCode, rHandler.error.message, rHandler.error.details);
        return;
    }

    let resBody: Record<string, unknown> | undefined = undefined;
    if (resBodySchema !== undefined) {
        // Validate the response body.
        const rValidateRes = safeParse(resBodySchema, rHandler.value.body);
        if (rValidateRes.failed) {
            // The response body was invalid.  Return an internal server error.
            sendError(res, HttpError._500_InternalServerError, "Server produced invalid response body.", rValidateRes.error);
            return;
        }
        resBody = rValidateRes.value;
    }

    // Everything has succeeded.  Send the successful response.
    sendSuccess(res, rHandler.value.statusCode, resBody);
}
