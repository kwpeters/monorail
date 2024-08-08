import { ArgumentsCamelCase, Argv, BuilderCallback, MiddlewareFunction } from "yargs";
import { Result } from "../../../packages/depot/src/result.js";


export interface IYargsCommandDefinition<TArgs> {
    command: string | readonly string[];
    description: string;
    builder?: BuilderCallback<NonNullable<unknown>, Argv<TArgs>>;
    // Yargs handlers return void or Promise<void>.  I have changed that so I
    // can more explicitly return any error messages and set the process exit
    // code.
    handler?: (args: ArgumentsCamelCase<TArgs>) => Promise<Result<number, string>>;
    middlewares?: Array<MiddlewareFunction<TArgs>>;
    deprecated?: boolean | string;
}
