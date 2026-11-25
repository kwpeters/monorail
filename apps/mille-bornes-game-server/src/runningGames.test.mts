import { NoneOption } from "@repo/depot/option";
import { SucceededResult } from "@repo/depot/result";
import { shuffleDeck } from "@repo/mille-bornes-core/deck";
import { type Game, type Seat } from "@repo/mille-bornes-core/game";
import { GameId, PlayerId } from "@repo/mille-bornes-core/ids";
import { applyPendingCommand, beginGame, createPending } from "@repo/mille-bornes-core/pendingGame";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { defaultTimings } from "./config.mjs";
import { FakeClock } from "./fakeClock.mjs";
import { collectingLogger } from "./logger.mjs";
import { RunningGames, stuckNotice } from "./runningGames.mjs";
import { MemorySnapshotStore } from "./snapshotStore.mjs";
import { Table, type TableOptions } from "./table.mjs";


function seat(name: string, kind: Seat["kind"]): Seat {
    return { id: PlayerId.create(), name: PlayerName.tryCreate(name).throwIfFailed(), kind };
}


const ann = seat("Ann", "Human");
const robot = seat("Bolt", "Robot");


// Ann (human) and a robot, just dealt.
function dealt(): Game {
    const pending = applyPendingCommand(
        createPending(GameId.create(), ann), ann.id, { type: "AddRobot", seat: robot }
    ).throwIfFailed();
    return beginGame(pending, ann.id, shuffleDeck("Reduced", seededRandom(3))).throwIfFailed().game;
}


interface Harness {
    readonly games:     RunningGames;
    readonly store:     MemorySnapshotStore;
    readonly logger:    ReturnType<typeof collectingLogger>;
    readonly published: Array<ReadonlyArray<PlayerId>>;
    readonly notices:   Map<PlayerId, string>;
    /** The options the last Table was made with. */
    readonly tableOpts: () => TableOptions;
}


function harness(): Harness {
    const store = new MemorySnapshotStore();
    const logger = collectingLogger();
    const published: Array<ReadonlyArray<PlayerId>> = [];
    const notices = new Map<PlayerId, string>();
    let last: TableOptions | undefined;
    const tableFactory = (o: TableOptions): Table => {
        last = o;
        return new Table(o);
    };
    const persist = async (write: () => Promise<void>): Promise<SucceededResult<void>> => {
        await write();
        return new SucceededResult(undefined);
    };
    const games = new RunningGames({
        store,
        clock:       new FakeClock(),
        rand:        seededRandom(1),
        timings:     defaultTimings,
        logger,
        tableFactory,
        isConnected: () => false,
        persist,
        publish:     (players) => { published.push(players); },
        notify:      (p, notice) => { notices.set(p, notice); }
    });
    return { games, store, logger, published, notices, tableOpts: () => last! };
}


describe("RunningGames", () => {

    describe("instance", () => {

        describe("start()", () => {

            it("runs the game for its humans only", () => {
                const h = harness();
                const game = dealt();

                h.games.start(game, ann.id).throwIfFailed();

                expect(h.games.of(ann.id).mapSome((r) => r.game).toNullable(null)).toBe(game);
                expect(h.games.of(robot.id)).toEqual(NoneOption.get());
                expect(h.games.list().map((e) => [e.state, e.organizerName]))
                .toEqual([["Running", ann.name]]);
            });

        });


        describe("onUpdate", () => {

            it("drops an update older than the newest one shown", async () => {
                const h = harness();
                const game = dealt();
                const r = h.games.start(game, ann.id).throwIfFailed();

                h.tableOpts().onUpdate({ game, seq: 5, events: [] });
                h.tableOpts().onUpdate({ game, seq: 3, events: [] });

                expect(r.seq).toBe(5);
                expect(h.published).toEqual([[ann.id]]);
                const { games } = await h.store.loadAll();
                expect(games[0]?.record.state === "Running" ? games[0].record.seq : -1).toBe(5);
            });

        });


        describe("onStuck", () => {

            it("ends the game, quarantines it and leaves the humans a notice", async () => {
                const h = harness();
                const game = dealt();
                const r = h.games.start(game, ann.id).throwIfFailed();
                (await h.games.accepted(r, [])).throwIfFailed();
                expect((await h.store.loadAll()).games.length).toBe(1);

                r.table.dispose();
                h.tableOpts().onStuck("broken");

                expect(h.games.get(game.config.id)).toEqual(NoneOption.get());
                expect(h.notices.get(ann.id)).toBe(stuckNotice);
                expect((await h.store.loadAll()).games).toEqual([]);
                expect(h.logger.lines.some((l) => l.startsWith("ERROR") && l.includes("broken")))
                .toBeTrue();
            });

        });

    });

});
