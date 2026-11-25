import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import type { PlayerCommand } from "@repo/mille-bornes-core/commands";
import type { TeamIndex } from "@repo/mille-bornes-core/ids";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { useRef, type ReactElement } from "react";
import type { Api } from "../api/client.mjs";
import { voidWire } from "../api/outcomes.mjs";
import { prefersReducedMotion, useFlyingCards } from "../animation/FlyingCard.js";
import { useAnimator } from "../animation/useAnimator.js";
import { useSound } from "../sound/useSound.js";
import type { EventBatch } from "../state/screenStore.mjs";
import { EndGameDialog } from "../table/EndGameDialog.js";
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
import { hazardAlertText, topBarMessage } from "../text/phaseHint.mjs";
import { GameOverScreen } from "./GameOverScreen.js";
import { RaceSummary } from "./RaceSummary.js";


/** The server's `Playing` screen. */
export type PlayingData = Extract<Screen, { kind: "Playing" }>;


/**
 * What `GameScreen` needs.  The store's queue comes in as props (not a
 * context): `GameScreen` is its only consumer, and its tests pass it plainly.
 */
export interface GameScreenProps {
    screen:        PlayingData;
    api:           Api;
    /** The store's batches still to animate, oldest first. */
    pendingEvents: ReadonlyArray<EventBatch>;
    /** Marks a batch as played. */
    consumeEvents: (id: number) => void;
}


// How long the top bar shows why a card cannot be played.
const reasonMs = 3000;


// The hazard window's length as the top bar states it: what was left when
// the screen was sent.  Fixed per screen, because the top bar is a live
// region and must not be re-announced every second.  Under a second it is 0,
// and the top bar then states no time.
function windowSeconds(screen: PlayingData): Option<number> {
    return Option.fromNullable(screen.timer?.kind === "HazardWindow" ? screen.timer : null)
    .mapSome((t) => t.remainingMs < 1000 ? 0 : Math.ceil(t.remainingMs / 1000));
}


/**
 * The game table: the message bar, one row per team, the last move, the
 * piles and the viewer's hand, plus the hazard banner and the Extension
 * offer when they apply.  A play is two taps: a card, then a target (a lane,
 * the discard pile, or Play); the server judges it, and a refusal shows in
 * the top bar.  Components inside it can show a transient top bar message
 * through `useSetOverride()`.  The pending events play as animations, one
 * batch after another, and the last move line follows the batch that is
 * playing, so the words and the motion agree; the batch's sounds and
 * vibration start with it.
 * @param props - The Playing screen, the API and the store's event queue
 * @returns The table
 */
export function GameScreen(props: GameScreenProps): ReactElement {
    const { screen, api } = props;
    const { view } = screen;
    const flying = useFlyingCards();
    const onBatchStart = useSound();
    const started = useAnimator(props.pendingEvents, props.consumeEvents, view, {
        play:          flying.play,
        reducedMotion: prefersReducedMotion,
        onBatchStart
    });
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

    const tableBody = (
        <OverrideContext.Provider value={setOverride}>
            <HazardBanner screen={screen} alert={hazardAlertText(view)} />
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
            <LastMove
                events={started.match((b) => b.events, () => [])}
                view={started.match((b) => b.view, () => view)}
            />
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
        </OverrideContext.Provider>
    );

    // The one place that depends on the phase.  The frame (and with it the
    // top bar's live region) stays mounted as the phase changes.
    const table = view.phase.kind !== "RaceOver" && view.phase.kind !== "GameOver";
    const body = ((): ReactElement => {
        switch (view.phase.kind) {
            case "Turn":
            case "HazardIncoming":
            case "ExtensionOffer":
                return tableBody;
            case "RaceOver":
                return <RaceSummary screen={screen} />;
            case "GameOver":
                return <GameOverScreen screen={screen} api={api} />;
        }
    })();

    return (
        <section
            className={table ? "screen table" : "screen"}
            // Tapping the table outside any control puts the card back; the
            // banner and the offer are not background.
            onClick={(e) => {
                const keep = "button, dialog, .hazard-banner, .extension-offer";
                if (!(e.target instanceof Element && e.target.closest(keep))) {
                    dispatch({ type: "Cancel" });
                }
            }}
        >
            <TopBar text={message.text} tone={message.tone} />
            {screen.isOrganizer && view.phase.kind !== "GameOver" ?
                <EndGameDialog api={api} /> :
                null}
            {body}
            {flying.layer}
        </section>
    );
}
