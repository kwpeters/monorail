/* eslint-disable @typescript-eslint/naming-convention */
import React from "react";
import { Text } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import Table from "./components/table.js";
interface Props {
    name: string | undefined;
}



export default function App({name = "Stranger"}: Props): React.JSX.Element {
    return (
        <>
            <Gradient name="summer">
                <BigText text="Crypto CLI" align="center" font="chrome"></BigText>
            </Gradient>
            <Text>
                Hello, <Text color="green">{name}</Text>
            </Text>
            <Table/>
        </>
    );
}
