/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { z } from "zod";


export const greetingInput = z.object({ name: z.string() });
export type GreetingOutput = { message: string };
