#!/usr/bin/env node
// eslint-disable-next-line @typescript-eslint/naming-convention
import React from "react";
import {render} from "ink";
import meow from "meow";
// eslint-disable-next-line @typescript-eslint/naming-convention
import App from "./app.js";

const cli = meow(
    `
    Usage
      $ ink-sample-app-xyzzy

    Options
        --name  Your name

    Examples
      $ ink-sample-app-xyzzy --name=Jane
      Hello, Jane
`,
    {
        importMeta: import.meta,
        flags:      {
            name: {
                type: "string",
            },
        },
    },
);

render(<App name={cli.flags.name} />);
