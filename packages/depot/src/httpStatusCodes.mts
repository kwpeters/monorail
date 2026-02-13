/* eslint-disable @typescript-eslint/naming-convention */

import { z } from "zod";


// eslint-disable-next-line @typescript-eslint/naming-convention
export const HttpSuccess = {
    _200_OK:                          200,
    _201_Created:                     201,
    _202_Accepted:                    202,
    _203_NonAuthoritativeInformation: 203,
    _204_NoContent:                   204,
    _205_ResetContent:                205,
    _206_PartialContent:              206,
    _207_MultiStatus:                 207,
    _208_AlreadyReported:             208,
    _226_IMUsed:                      226,
} as const;
export const httpSuccessSchema = z.enum(HttpSuccess);
export type HttpSuccess = z.infer<typeof httpSuccessSchema>;
// Enumerating values of HttpSuccess:
//     for (const cur of Object.values(HttpSuccess)) {}
//     for (const cur of httpSuccessSchema.options) {}


/**
 * A type representing a valid key in the HttpSuccess enumeration.
 * Useful when creating mapped types.  For example:
 *     export type HttpSuccessCounts = {
 *         [K in HttpSuccessKey]: number;
 *     };
 */
export type HttpSuccessKey = keyof typeof HttpSuccess;


/**
 * Gets the key name for a given HttpSuccess value.  Useful when indexing
 * into a type (probably a mapped type) that has the same keys as
 * HttpSuccess.
 *
 * @param successHttpStatusCode - The HttpSuccess to find the key of
 * @return The key that corresponds to the specified HttpSuccess.
 */
export function successHttpStatusCodeKey(successHttpStatusCode: HttpSuccess): HttpSuccessKey {
    for (const [key, val] of Object.entries(HttpSuccess)) {
        if (val === successHttpStatusCode) {
            return key as HttpSuccessKey;
        }
    }

    // Should never happen, but just in case...
    throw new Error(`Failed to find key for HttpSuccess "${successHttpStatusCode}".`);
}


////////////////////////////////////////////////////////////////////////////////


// eslint-disable-next-line @typescript-eslint/naming-convention
export const HttpError = {
    _400_BadRequest:                    400,
    _401_Unauthorized:                  401,
    _402_PaymentRequired:               402,
    _403_Forbidden:                     403,
    _404_NotFound:                      404,
    _405_MethodNotAllowed:              405,
    _406_NotAcceptable:                 406,
    _407_ProxyAuthenticationRequired:   407,
    _408_RequestTimeout:                408,
    _409_Conflict:                      409,
    _410_Gone:                          410,
    _411_LengthRequired:                411,
    _412_PreconditionFailed:            412,
    _413_PayloadTooLarge:               413,
    _414_URITooLong:                    414,
    _415_UnsupportedMediaType:          415,
    _416_RangeNotSatisfiable:           416,
    _417_ExpectationFailed:             417,
    _418_ImATeapot:                     418,
    _421_MisdirectedRequest:            421,
    _422_UnprocessableEntity:           422,
    _423_Locked:                        423,
    _424_FailedDependency:              424,
    _425_TooEarly:                      425,
    _426_UpgradeRequired:               426,
    _428_PreconditionRequired:          428,
    _429_TooManyRequests:               429,
    _431_RequestHeaderFieldsTooLarge:   431,
    _451_UnavailableForLegalReasons:    451,
    _500_InternalServerError:           500,
    _501_NotImplemented:                501,
    _502_BadGateway:                    502,
    _503_ServiceUnavailable:            503,
    _504_GatewayTimeout:                504,
    _505_HTTPVersionNotSupported:       505,
    _506_VariantAlsoNegotiates:         506,
    _507_InsufficientStorage:           507,
    _508_LoopDetected:                  508,
    _510_NotExtended:                   510,
    _511_NetworkAuthenticationRequired: 511
} as const;
export const httpErrorSchema = z.enum(HttpError);
export type HttpError = z.infer<typeof httpErrorSchema>;
// Enumerating values of HttpError:
//     for (const cur of Object.values(HttpError)) {}
//     for (const cur of httpErrorSchema.options) {}


/**
 * A type representing a valid key in the HttpError enumeration.
 * Useful when creating mapped types.  For example:
 *     export type HttpErrorCounts = {
 *         [K in HttpErrorKey]: number;
 *     };
 */
export type HttpErrorKey = keyof typeof HttpError;


/**
 * Gets the key name for a given HttpError value.  Useful when indexing
 * into a type (probably a mapped type) that has the same keys as
 * HttpError.
 *
 * @param httpError - The HttpError to find the key of
 * @return The key that corresponds to the specified HttpError.
 */
export function errorHttpStatusCodeKey(httpError: HttpError): HttpErrorKey {
    for (const [key, val] of Object.entries(HttpError)) {
        if (val === httpError) {
            return key as HttpErrorKey;
        }
    }

    // Should never happen, but just in case...
    throw new Error(`Failed to find key for HttpError "${httpError}".`);
}
