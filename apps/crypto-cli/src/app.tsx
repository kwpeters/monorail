// eslint-disable-next-line @typescript-eslint/naming-convention
import React from "react";
import {Text} from "ink";

interface Props {
    name: string | undefined;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export default function App({name = "Stranger"}: Props): React.JSX.Element {
    return (
        <Text>
            Hello, <Text color="green">{name}</Text>
        </Text>
    );
}
