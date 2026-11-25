import { Option } from "@repo/depot/option";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import type { ReactElement } from "react";
import { Hand } from "../table/Hand.js";
import { LastMove } from "../table/LastMove.js";
import { Piles } from "../table/Piles.js";
import { playerOnTurn } from "../table/playerOnTurn.mjs";
import { TeamRow } from "../table/TeamRow.js";
import { TopBar } from "../table/TopBar.js";
import { OverrideContext, useOverrideMessage } from "../table/useOverrideMessage.js";
import { topBarMessage } from "../text/phaseHint.mjs";


/** The server's `Playing` screen. */
export type PlayingData = Extract<Screen, { kind: "Playing" }>;


/** What `GameScreen` needs. */
export interface GameScreenProps {
    screen: PlayingData;
}


/**
 * The game table: the message bar, one row per team, the last move, the
 * piles and the viewer's hand.  Components inside it can show a transient
 * top bar message through `useSetOverride()`.
 * @param props - The Playing screen
 * @returns The table
 */
export function GameScreen(props: GameScreenProps): ReactElement {
    const { screen } = props;
    const { view } = screen;
    const { override, setOverride } = useOverrideMessage();
    const message = override.defaultValue(topBarMessage(view));
    const onTurn = playerOnTurn(view);
    const robots = Option.fromNullable(screen.robots);
    const connected = Option.fromNullable(screen.connected);

    const table = (
        <OverrideContext.Provider value={setOverride}>
            <section className="screen table">
                <TopBar text={message.text} tone={message.tone} />
                <div className="scoreboard">
                    {view.teams.map((team) => (
                        <TeamRow
                            key={team.index}
                            view={view}
                            team={team}
                            onTurn={onTurn}
                            robots={robots}
                            connected={connected}
                        />
                    ))}
                </div>
                <LastMove events={screen.events} view={view} />
                <Piles
                    drawPileCount={view.drawPileCount}
                    discardTop={Option.fromNullable(view.discardTop)}
                />
                <Hand cards={view.me.hand} />
            </section>
        </OverrideContext.Provider>
    );

    // The one place that depends on the phase.  Task 9 gives RaceOver and
    // GameOver their own screens here; until then every phase shows the table.
    switch (view.phase.kind) {
        case "Turn":
        case "HazardIncoming":
        case "ExtensionOffer":
        case "RaceOver":
        case "GameOver":
            return table;
    }
}
