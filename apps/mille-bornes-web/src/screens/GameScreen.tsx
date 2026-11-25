import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import type { PlayerCommand } from "@repo/mille-bornes-core/commands";
import type { TeamIndex } from "@repo/mille-bornes-core/ids";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { useRef, type ReactElement } from "react";
import type { Api } from "../api/client.mjs";
import { voidWire } from "../api/outcomes.mjs";
import { ExtensionOffer } from "../table/ExtensionOffer.js";
import { Hand } from "../table/Hand.js";
import { HazardBanner } from "../table/HazardBanner.js";
import { LastMove } from "../table/LastMove.js";
import { Piles } from "../table/Piles.js";
import { playerOnTurn } from "../table/playerOnTurn.mjs";
import { targetsFor, type Targets } from "../table/playController.mjs";
import { TeamRow } from "../table/TeamRow.js";
import { TopBar } from "../table/TopBar.js";
import { OverrideContext, useOverrideMessage } from "../table/useOverrideMessage.js";
import { useSelection } from "../table/useSelection.js";
import { topBarMessage } from "../text/phaseHint.mjs";


/** The server's `Playing` screen. */
export type PlayingData = Extract<Screen, { kind: "Playing" }>;


/** What `GameScreen` needs. */
export interface GameScreenProps {
    screen: PlayingData;
    api:    Api;
}


// How long the top bar shows why a card cannot be played.
const reasonMs = 3000;


// The hazard window's length as the top bar states it: what was left when
// the screen was sent.  Fixed per screen, because the top bar is a live
// region and must not be re-announced every second.
function windowSeconds(screen: PlayingData): Option<number> {
    return Option.fromNullable(screen.timer?.kind === "HazardWindow" ? screen.timer : null)
    .mapSome((t) => Math.max(1, Math.ceil(t.remainingMs / 1000)));
}


/**
 * The game table: the message bar, one row per team, the last move, the
 * piles and the viewer's hand, plus the hazard banner and the Extension
 * offer when they apply.  A play is two taps: a card, then a target (a lane,
 * the discard pile, or Play); the server judges it, and a refusal shows in
 * the top bar.  Components inside it can show a transient top bar message
 * through `useSetOverride()`.
 * @param props - The Playing screen and the API
 * @returns The table
 */
export function GameScreen(props: GameScreenProps): ReactElement {
    const { screen, api } = props;
    const { view } = screen;
    const { override, setOverride } = useOverrideMessage();
    const { selection, dispatch } = useSelection(view, setOverride);
    const phaseMessage = windowSeconds(screen).match(
        (seconds) => topBarMessage(view, seconds),
        () => topBarMessage(view)
    );
    const message = override.defaultValue(phaseMessage);
    const onTurn = playerOnTurn(view);
    const robots = Option.fromNullable(screen.robots);
    const connected = Option.fromNullable(screen.connected);

    // Set before the first await: two taps in the same tick send one command.
    const inFlight = useRef(false);

    const send = async (command: PlayerCommand): Promise<void> => {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        // Cleared now rather than on the answer: the next screen may arrive
        // first, and the selection must not look stale under it.
        dispatch({ type: "TapTarget" });
        try {
            const result = await api.call((t) => t.game.play.mutate(command), voidWire);
            if (!result.succeeded) {
                setOverride(result.error);
            }
        }
        finally {
            // eslint-disable-next-line require-atomic-updates -- only cleared here
            inFlight.current = false;
        }
    };

    const sender = (command: PlayerCommand) => (): void => void send(command);

    const tapCard = (card: Card, index: number): void => {
        if (inFlight.current) {
            return;
        }
        const { targets, reason } = targetsFor(view, card);
        const isSelected = selection.kind === "Card" && selection.index === index;
        if (!isSelected && reason.isSome) {
            setOverride(reason.value, "Info", reasonMs);
        }
        // A card with no play can still be picked up to discard it.
        if (isSelected || targets.kind !== "None" || targets.discard.isSome) {
            dispatch({ type: "TapCard", card, index });
        }
    };

    const picked: Option<Targets> = selection.kind === "Card" ?
        new SomeOption(targetsFor(view, selection.card).targets) :
        NoneOption.get();
    const play = picked.bind((t) => t.kind === "Immediate" ?
        new SomeOption(sender(t.command)) :
        NoneOption.get());
    const discard = picked.bind((t) => t.discard.mapSome(sender));
    const laneTarget = (team: TeamIndex): Option<() => void> => picked.bind((t) => {
        const found = t.kind === "Choose" ? t.teams.find((c) => c.team === team) : undefined;
        return Option.fromNullable(found).mapSome((c) => sender(c.command));
    });

    const table = (
        <OverrideContext.Provider value={setOverride}>
            <section
                className="screen table"
                // Tapping the table outside any control puts the card back.
                onClick={(e) => {
                    if (!(e.target instanceof Element && e.target.closest("button, dialog"))) {
                        dispatch({ type: "Cancel" });
                    }
                }}
            >
                <TopBar text={message.text} tone={message.tone} />
                <HazardBanner screen={screen} alert={phaseMessage.text} />
                <ExtensionOffer screen={screen} onDecide={(command) => void send(command)} />
                <div className="scoreboard">
                    {view.teams.map((team) => (
                        <TeamRow
                            key={team.index}
                            view={view}
                            team={team}
                            onTurn={onTurn}
                            robots={robots}
                            connected={connected}
                            onPlayHere={laneTarget(team.index)}
                        />
                    ))}
                </div>
                <LastMove events={screen.events} view={view} />
                <Piles
                    drawPileCount={view.drawPileCount}
                    discardTop={Option.fromNullable(view.discardTop)}
                    onDiscard={discard}
                />
                <Hand
                    cards={view.me.hand}
                    selected={selection.kind === "Card" ?
                        new SomeOption(selection.index) :
                        NoneOption.get()}
                    playable={(card) => targetsFor(view, card).targets.kind !== "None"}
                    counter={(card) => {
                        const { targets } = targetsFor(view, card);
                        return targets.kind === "Immediate" && targets.command.type === "CoupFourre";
                    }}
                    onPlay={play}
                    onTap={tapCard}
                />
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
