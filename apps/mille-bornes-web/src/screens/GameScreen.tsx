import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import type { PlayerCommand } from "@repo/mille-bornes-core/commands";
import type { TeamIndex } from "@repo/mille-bornes-core/ids";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { useLayoutEffect, useRef, type ReactElement } from "react";
import type { Api } from "../api/client.mjs";
import { voidWire } from "../api/outcomes.mjs";
import { prefersReducedMotion, useFlyingCards } from "../animation/FlyingCard.js";
import { drawnSlots } from "../animation/shownTable.mjs";
import { useAnimator } from "../animation/useAnimator.js";
import { useAudioEngine, useSound } from "../sound/useSound.js";
import type { EventBatch } from "../state/screenStore.mjs";
import { EndGameDialog, type EndGameHandle } from "../table/EndGameDialog.js";
import { ExtensionOffer } from "../table/ExtensionOffer.js";
import { Hand } from "../table/Hand.js";
import { HazardBanner } from "../table/HazardBanner.js";
import { LastMove } from "../table/LastMove.js";
import { Piles } from "../table/Piles.js";
import { playerOnTurn } from "../table/playerOnTurn.mjs";
import { targetsFor, type Targets } from "../table/playController.mjs";
import { TableMenu } from "../table/TableMenu.js";
import { TeamRow } from "../table/TeamRow.js";
import { TopBar } from "../table/TopBar.js";
import { scrollToUncover } from "../table/uncover.mjs";
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


/**
 * Whether the page leaves out the shell's header for this screen: at the
 * table and between races, the top bar's menu (mute, End game) takes its
 * place; the game summary keeps the header.
 * @param screen - The screen the server sent
 * @returns True for a Playing screen that is not the game summary
 */
export function hidesShellBar(screen: Screen): boolean {
    return screen.kind === "Playing" && screen.view.phase.kind !== "GameOver";
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


// The top bar tells what the table shows (`shown`), but says at once what
// concerns the viewer's own controls: an alert, and the viewer's turn or
// offer, which start and end with them (never "Your turn" over an offer, or
// once the turn is over).
function barView(live: PlayerView, shown: PlayerView): PlayerView {
    const now = (v: PlayerView): boolean => {
        const { tone } = topBarMessage(v);
        return tone === "Alert" || tone === "MyTurn";
    };
    return now(live) || now(shown) ? live : shown;
}


/**
 * The game table: the message bar with the menu button (mute, and End game
 * for the organizer), one row per team, the last move, the
 * piles and the viewer's hand, plus the hazard banner and the Extension
 * offer when they apply.  A play is two taps: a card, then a target (a lane,
 * the discard pile, or Play); the server judges it, and a refusal shows in
 * the top bar.  Components inside it can show a transient top bar message
 * through `useSetOverride()`.  The pending events play as animations, one
 * batch after another, and the last move line follows the batch that is
 * playing, so the words and the motion agree; the batch's sounds and
 * vibration start with it.  The lanes, the piles and the top bar show the
 * table as the animations have brought it (`useAnimator()`'s shown view):
 * a card's result appears when it lands; the top bar says at once what the
 * viewer can act on (an alert, their turn or offer).  Everything the player acts on
 * (the hand, the buttons, the hazard banner) follows the live view, so a
 * play is never held back by an animation; a card the player drew stays
 * hidden in its place until its flight lands, except in a hazard window.
 * @param props - The Playing screen, the API and the store's event queue
 * @returns The table
 */
export function GameScreen(props: GameScreenProps): ReactElement {
    const { screen, api } = props;
    const { view } = screen;
    const flying = useFlyingCards();
    const onBatchStart = useSound();
    const { started, shown, drawing } = useAnimator(
        props.pendingEvents,
        props.consumeEvents,
        view,
        { play: flying.play, reducedMotion: prefersReducedMotion, onBatchStart }
    );
    const { override, setOverride } = useOverrideMessage();
    const { selection, dispatch } = useSelection(view, setOverride);
    const bar = barView(view, shown);
    const phaseMessage = windowSeconds(screen).match(
        (seconds) => topBarMessage(bar, seconds),
        () => topBarMessage(bar)
    );
    // The table's phases; a race or game summary takes the table's place.
    const table = view.phase.kind !== "RaceOver" && view.phase.kind !== "GameOver";
    // A transient message is about the table, so it never hides the summary's
    // announcement.
    const message = table ? override.defaultValue(phaseMessage) : phaseMessage;
    const onTurn = playerOnTurn(shown);
    // A card that may answer a hazard is never hidden.
    const flyingIn = view.phase.kind === "HazardIncoming" ?
        new Set<number>() :
        drawnSlots(view.me.hand, drawing);
    const engine = useAudioEngine();
    const endGame = useRef<EndGameHandle>(null);
    const hasMenu = hidesShellBar(screen);
    const robots = Option.fromNullable(screen.robots);
    const connected = Option.fromNullable(screen.connected);

    // Set before the first await: two taps in the same tick send one command.
    const inFlight = useRef(false);

    // On a short screen the hand stays at the bottom and the table scrolls
    // under it, so a picked-up card's targets (Discard, a lane) could be
    // under it.  The scroll is instant, so it is the same under reduced
    // motion.
    const tableRef = useRef<HTMLElement>(null);
    const pickedIndex = selection.kind === "Card" ? selection.index : -1;
    useLayoutEffect(() => {
        const root = tableRef.current;
        const handBox = root?.querySelector(".hand")?.getBoundingClientRect();
        if (pickedIndex < 0 || root === null || handBox === undefined) {
            return;
        }
        const targets = [...root.querySelectorAll(".pile-target, .lane-target")]
        .map((t) => t.getBoundingClientRect());
        const by = scrollToUncover(targets, handBox);
        if (by > 0) {
            window.scrollBy({ top: by, behavior: "instant" });
        }
    }, [pickedIndex]);

    // The card's flight leaves from where it was tapped: its box is read now,
    // before the screen that answers the play takes the card from the hand.
    const rememberLaunch = (command: PlayerCommand): void => {
        if (selection.kind !== "Card" || !("card" in command) || command.card !== selection.card) {
            return;
        }
        Option.fromNullable(
            tableRef.current?.querySelectorAll(".hand .card-button .card")[selection.index]
        ).mapSome((el) => flying.launchFrom(selection.card, el.getBoundingClientRect()));
    };

    const send = async (command: PlayerCommand): Promise<void> => {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        rememberLaunch(command);
        // Cleared now rather than on the answer: the next screen may arrive
        // first, and the selection must not look stale under it.
        dispatch({ type: "TapTarget" });
        try {
            const result = await api.call((t) => t.game.play.mutate(command), voidWire);
            if (!result.succeeded) {
                flying.forgetLaunch();
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
            <ExtensionOffer screen={screen} onDecide={(command) => void send(command)} />
            <div className="scoreboard">
                {shown.teams.map((team) => (
                    <TeamRow
                        key={team.index}
                        view={shown}
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
                drawPileCount={shown.drawPileCount}
                discardTop={Option.fromNullable(shown.discardTop)}
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
                hidden={flyingIn}
            />
        </OverrideContext.Provider>
    );

    // The one place that depends on the phase.  The frame (and with it the
    // top bar's live region) stays mounted as the phase changes.
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
            ref={tableRef}
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
            <div className={hasMenu ? "top-slot has-menu" : "top-slot"}>
                <TopBar text={message.text} tone={message.tone} />
                <HazardBanner
                    screen={screen}
                    alert={override.match((o) => o.text, () => hazardAlertText(view))}
                />
                {hasMenu ?
                    <TableMenu
                        engine={engine}
                        onEndGame={screen.isOrganizer ?
                            new SomeOption(() => endGame.current?.open()) :
                            NoneOption.get()}
                    /> :
                    null}
            </div>
            {screen.isOrganizer && hasMenu ? <EndGameDialog ref={endGame} api={api} /> : null}
            {body}
            {flying.layer}
        </section>
    );
}
