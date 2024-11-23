// eslint-disable-next-line @typescript-eslint/naming-convention
import React from "react";
import chalk from "chalk";
import test from "ava";
import {render} from "ink-testing-library";
// eslint-disable-next-line @typescript-eslint/naming-convention
import App from "./app.js";


test("greet unknown user", (t) => {
    const {lastFrame} = render(<App name={undefined} />);

    t.is(lastFrame(), `Hello, ${chalk.green("Stranger")}`);
});


test("greet user with a name", (t) => {
    const {lastFrame} = render(<App name="Jane" />);

    t.is(lastFrame(), `Hello, ${chalk.green("Jane")}`);
});
