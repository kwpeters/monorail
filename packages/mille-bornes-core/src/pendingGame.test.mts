import { type Applied } from "./commands.mjs";
import { createDeck } from "./deck.mjs";
import { createGame } from "./engine.mjs";
import { validateGameConfig, type Seat } from "./game.mjs";
import { GameId, PlayerId } from "./ids.mjs";
import {
    applyPendingCommand, beginGame, createPending, readiness, teamLayout,
    type PendingCommand, type PendingGame
} from "./pendingGame.mjs";
import { PlayerName } from "./playerName.mjs";
import type { Rejection } from "./rejection.mjs";
import { seatFor } from "./testHelpers.mjs";


const gameId = GameId.tryCreate("00000000-0000-4000-8000-0000000000aa").throwIfFailed();
const [a, b, c, d, e, f, g] = ["Ann", "Bob", "Cy", "Di", "Ed", "Flo", "Gus"].map((n) => seatFor(n)) as
    [Seat, Seat, Seat, Seat, Seat, Seat, Seat];
const robot = seatFor("Robo", "Robot");


// Each joiner adds themselves, in order.
function build(organizer: Seat, joiners: ReadonlyArray<Seat>): PendingGame {
    return joiners.reduce(
        (p, seat) => applyPendingCommand(p, seat.id, { type: "AddHuman", seat }).throwIfFailed(),
        createPending(gameId, organizer)
    );
}


function withRobot(p: PendingGame): PendingGame {
    return applyPendingCommand(p, p.organizer, { type: "AddRobot", seat: robot }).throwIfFailed();
}


function names(p: PendingGame): Array<string> {
    return p.seats.map((s) => s.name);
}


function rejectionOf(p: PendingGame, by: PlayerId, cmd: PendingCommand): Rejection {
    return applyPendingCommand(p, by, cmd).throwIfSucceeded();
}


describe("pendingGame", () => {

    describe("createPending()", () => {

        it("starts with the organizer alone and the Quick length", () => {
            const p = createPending(gameId, a);
            expect(p).toEqual({ id: gameId, organizer: a.id, length: "Quick", seats: [a] });
        });


        it("seats the organizer as a human", () => {
            expect(createPending(gameId, robot).seats[0]!.kind).toBe("Human");
        });


        it("stores a copy of the organizer's seat without extra properties", () => {
            const input = { ...a, secret: "x" };
            const p = createPending(gameId, input);
            expect(JSON.stringify(p)).not.toContain("secret");
            expect(p.seats[0]).not.toBe(input);
        });


        it("is plain JSON", () => {
            const p = build(a, [b, c]);
            expect(JSON.parse(JSON.stringify(p))).toEqual(p);
        });

    });


    describe("applyPendingCommand()", () => {

        describe("AddHuman", () => {

            it("appends the new seat to the end", () => {
                expect(names(build(a, [b, c]))).toEqual(["Ann", "Bob", "Cy"]);
            });


            it("is allowed only for oneself", () => {
                const p = createPending(gameId, a);
                expect(rejectionOf(p, a.id, { type: "AddHuman", seat: b })).toEqual({ reason: "NotOrganizer" });
                expect(rejectionOf(p, b.id, { type: "AddHuman", seat: c })).toEqual({ reason: "NotOrganizer" });
            });


            it("refuses a seat that has already joined", () => {
                const p = build(a, [b]);
                expect(rejectionOf(p, b.id, { type: "AddHuman", seat: b })).toEqual({ reason: "SeatAlreadyJoined" });
                expect(rejectionOf(p, a.id, { type: "AddHuman", seat: a })).toEqual({ reason: "SeatAlreadyJoined" });
            });


            it("refuses a name used by another seat, ignoring case, spacing and width", () => {
                const p = build(a, [b]);
                for (const raw of ["ann", "  ANN ", "Ａnn"]) {
                    const seat: Seat = { ...c, name: PlayerName.tryCreate(raw).throwIfFailed() };
                    expect(rejectionOf(p, seat.id, { type: "AddHuman", seat }))
                    .withContext(raw)
                    .toEqual({ reason: "NameTaken", name: seat.name });
                }
            });


            it("refuses a name taken by a robot", () => {
                const p = withRobot(createPending(gameId, a));
                const seat: Seat = { ...b, name: PlayerName.tryCreate("ROBO").throwIfFailed() };
                expect(rejectionOf(p, seat.id, { type: "AddHuman", seat }))
                .toEqual({ reason: "NameTaken", name: seat.name });
            });


            it("refuses a seventh seat", () => {
                const p = build(a, [b, c, d, e, f]);
                expect(p.seats.length).toBe(6);
                expect(rejectionOf(p, g.id, { type: "AddHuman", seat: g })).toEqual({ reason: "TooManyPlayers" });
            });


            it("refuses a robot seat as malformed", () => {
                const p = createPending(gameId, a);
                expect(rejectionOf(p, robot.id, { type: "AddHuman", seat: robot }))
                .toEqual({ reason: "MalformedCommand" });
            });


            it("refuses a seat whose name or id could not have been made by PlayerName or PlayerId", () => {
                const p = createPending(gameId, a);
                const badSeats: ReadonlyArray<[string, unknown]> = [
                    ["empty name", { ...c, name: "" }],
                    ["21 code points", { ...c, name: "x".repeat(21) }],
                    ["control character", { ...c, name: "Cy" }],
                    ["bidi override", { ...c, name: "Cy‮evil" }],
                    ["unnormalized spacing", { ...c, name: "  Cy  " }],
                    ["non-canonical id", { ...c, id: "NOT-A-UUID" }],
                    ["uppercase id", { ...c, id: "00000000-0000-4000-8000-00000000000A" }],
                    ["unknown kind", { ...c, kind: "Cat" }],
                ];
                for (const [label, seat] of badSeats) {
                    const cmd = { type: "AddHuman", seat } as unknown as PendingCommand;
                    const result = applyPendingCommand(p, (seat as Seat).id, cmd);
                    expect(result.throwIfSucceeded()).withContext(label).toEqual({ reason: "MalformedCommand" });
                }
                expect(PlayerName.tryCreate("x".repeat(20)).succeeded).toBeTrue();
                const exactly20: Seat = { ...c, name: PlayerName.tryCreate("x".repeat(20)).throwIfFailed() };
                expect(applyPendingCommand(p, c.id, { type: "AddHuman", seat: exactly20 }).succeeded).toBeTrue();
            });


            it("stores a copy of the seat without extra properties", () => {
                const input = { ...b, secret: "x" };
                const p = applyPendingCommand(createPending(gameId, a), b.id, { type: "AddHuman", seat: input })
                .throwIfFailed();
                expect(p.seats[1]).toEqual(b);
                expect(JSON.stringify(p)).not.toContain("secret");
                expect(p.seats[1]).not.toBe(input);
                (input as { name: string }).name = "Changed";
                expect(p.seats[1]!.name).toBe(b.name);
            });

        });


        describe("AddRobot", () => {

            it("lets the organizer append a robot", () => {
                expect(names(withRobot(build(a, [b])))).toEqual(["Ann", "Bob", "Robo"]);
            });


            it("is refused for anyone else", () => {
                const p = build(a, [b]);
                expect(rejectionOf(p, b.id, { type: "AddRobot", seat: robot })).toEqual({ reason: "NotOrganizer" });
                expect(rejectionOf(p, c.id, { type: "AddRobot", seat: robot })).toEqual({ reason: "NotOrganizer" });
            });


            it("refuses a human seat as malformed", () => {
                const p = createPending(gameId, a);
                expect(rejectionOf(p, a.id, { type: "AddRobot", seat: b })).toEqual({ reason: "MalformedCommand" });
            });


            it("refuses a duplicate id, a taken name and a seventh seat", () => {
                const p = build(a, [b]);
                expect(rejectionOf(withRobot(p), a.id, { type: "AddRobot", seat: robot }))
                .toEqual({ reason: "SeatAlreadyJoined" });
                const sameName: Seat = { ...robot, id: PlayerId.create(), name: b.name };
                expect(rejectionOf(p, a.id, { type: "AddRobot", seat: sameName }))
                .toEqual({ reason: "NameTaken", name: b.name });
                const full = build(a, [b, c, d, e, f]);
                expect(rejectionOf(full, a.id, { type: "AddRobot", seat: robot })).toEqual({ reason: "TooManyPlayers" });
            });

        });


        describe("RemoveSeat", () => {

            it("lets the organizer remove another seat", () => {
                const p = applyPendingCommand(build(a, [b, c]), a.id, { type: "RemoveSeat", id: b.id })
                .throwIfFailed();
                expect(names(p)).toEqual(["Ann", "Cy"]);
            });


            it("lets anyone remove themselves except the organizer", () => {
                const p = applyPendingCommand(build(a, [b, c]), c.id, { type: "RemoveSeat", id: c.id })
                .throwIfFailed();
                expect(names(p)).toEqual(["Ann", "Bob"]);
            });


            it("refuses the organizer removing themselves", () => {
                const p = build(a, [b]);
                expect(rejectionOf(p, a.id, { type: "RemoveSeat", id: a.id })).toEqual({ reason: "OrganizerCannotLeave" });
                expect(rejectionOf(p, b.id, { type: "RemoveSeat", id: a.id })).toEqual({ reason: "NotOrganizer" });
            });


            it("refuses a non-organizer removing someone else", () => {
                const p = build(a, [b, c]);
                expect(rejectionOf(p, b.id, { type: "RemoveSeat", id: c.id })).toEqual({ reason: "NotOrganizer" });
            });


            it("refuses an unknown id", () => {
                const p = build(a, [b]);
                expect(rejectionOf(p, a.id, { type: "RemoveSeat", id: g.id })).toEqual({ reason: "NoSuchSeat" });
                expect(rejectionOf(p, g.id, { type: "RemoveSeat", id: g.id })).toEqual({ reason: "NoSuchSeat" });
            });

        });


        describe("SwapSeats", () => {

            it("exchanges two seats in the order", () => {
                const p = build(a, [b, c, d]);
                const swapped = applyPendingCommand(p, a.id, { type: "SwapSeats", a: b.id, b: c.id }).throwIfFailed();
                expect(names(swapped)).toEqual(["Ann", "Cy", "Bob", "Di"]);
                expect(teamLayout(swapped).throwIfFailed().map((team) => team.map((s): string => s.name)))
                .toEqual([["Ann", "Bob"], ["Cy", "Di"]]);
            });


            it("leaves the order alone when a seat is swapped with itself", () => {
                const p = build(a, [b, c]);
                expect(applyPendingCommand(p, a.id, { type: "SwapSeats", a: b.id, b: b.id }).throwIfFailed())
                .toEqual(p);
            });


            it("refuses an unknown id", () => {
                const p = build(a, [b, c, d]);
                expect(rejectionOf(p, a.id, { type: "SwapSeats", a: b.id, b: g.id })).toEqual({ reason: "NoSuchSeat" });
                expect(rejectionOf(p, a.id, { type: "SwapSeats", a: g.id, b: b.id })).toEqual({ reason: "NoSuchSeat" });
            });


            it("is refused for a non-organizer", () => {
                const p = build(a, [b, c, d]);
                expect(rejectionOf(p, b.id, { type: "SwapSeats", a: b.id, b: c.id })).toEqual({ reason: "NotOrganizer" });
            });

        });


        describe("SetLength", () => {

            it("lets the organizer choose the length", () => {
                const p = applyPendingCommand(createPending(gameId, a), a.id, { type: "SetLength", length: "Full" })
                .throwIfFailed();
                expect(p.length).toBe("Full");
            });


            it("is refused for a non-organizer", () => {
                const p = build(a, [b]);
                expect(rejectionOf(p, b.id, { type: "SetLength", length: "Short" })).toEqual({ reason: "NotOrganizer" });
            });


            it("refuses an unknown length as malformed", () => {
                const p = createPending(gameId, a);
                const cmd = { type: "SetLength", length: "Endless" } as unknown as PendingCommand;
                expect(rejectionOf(p, a.id, cmd)).toEqual({ reason: "MalformedCommand" });
            });

        });


        it("refuses an unknown or incomplete command as malformed without throwing", () => {
            const p = createPending(gameId, a);
            const hostile = [
                { type: "Explode" }, null, 42, {}, { type: "AddHuman" }, { type: "AddRobot", seat: 7 },
                { type: "RemoveSeat" }, { type: "SwapSeats", a: b.id }, { type: "SetLength" },
            ];
            for (const cmd of hostile) {
                expect(rejectionOf(p, a.id, cmd as unknown as PendingCommand)).toEqual({ reason: "MalformedCommand" });
            }
        });


        it("does not modify the pending game it is given", () => {
            const p = build(a, [b]);
            const before = JSON.stringify(p);
            withRobot(p);
            applyPendingCommand(p, a.id, { type: "SetLength", length: "Full" });
            expect(JSON.stringify(p)).toBe(before);
        });

    });


    describe("teamLayout()", () => {

        function layout(p: PendingGame): Array<Array<string>> {
            return teamLayout(p).throwIfFailed().map((team) => team.map((s): string => s.name));
        }


        it("makes teams of one for 2 and 3 seats", () => {
            expect(layout(build(a, [b]))).toEqual([["Ann"], ["Bob"]]);
            expect(layout(build(a, [b, c]))).toEqual([["Ann"], ["Bob"], ["Cy"]]);
        });


        it("puts alternate seats together for 4 seats", () => {
            expect(layout(build(a, [b, c, d]))).toEqual([["Ann", "Cy"], ["Bob", "Di"]]);
        });


        it("makes 3 teams of 2 for 6 seats", () => {
            expect(layout(build(a, [b, c, d, e, f]))).toEqual([["Ann", "Di"], ["Bob", "Ed"], ["Cy", "Flo"]]);
        });


        it("fails with the seat count when there is no variant", () => {
            expect(teamLayout(build(a, [])).throwIfSucceeded()).toEqual({ reason: "UnsupportedPlayerCount", count: 1 });
            expect(teamLayout(build(a, [b, c, d, e])).throwIfSucceeded())
            .toEqual({ reason: "UnsupportedPlayerCount", count: 5 });
        });

    });


    describe("readiness()", () => {

        it("fails for the organizer alone, with advice to add a robot", () => {
            const rejection = readiness(createPending(gameId, a)).throwIfSucceeded();
            expect(rejection).toEqual({ reason: "UnsupportedPlayerCount", count: 1 });
        });


        it("succeeds with 2 teams of 1 once a robot is added", () => {
            const config = readiness(withRobot(createPending(gameId, a))).throwIfFailed();
            expect(config.teams.map((team) => team.length)).toEqual([1, 1]);
        });


        it("fails for 5 seats", () => {
            expect(readiness(build(a, [b, c, d, e])).throwIfSucceeded())
            .toEqual({ reason: "UnsupportedPlayerCount", count: 5 });
        });


        it("fails with something other than WrongDeck for a hand-built pending game that cannot be played", () => {
            const twin: Seat = { ...b, id: PlayerId.create(), name: a.name };
            const duplicateNames: PendingGame = { ...createPending(gameId, a), seats: [a, twin] };
            const noHuman: PendingGame = {
                ...createPending(gameId, a),
                seats: [{ ...a, kind: "Robot" }, { ...b, kind: "Robot" }],
            };
            for (const p of [duplicateNames, noHuman]) {
                expect(readiness(p).throwIfSucceeded()).toEqual({ reason: "MalformedCommand" });
                expect(beginGame(p, a.id, createDeck("Reduced")).throwIfSucceeded())
                .toEqual({ reason: "MalformedCommand" });
            }
        });


        it("gives a config that validateGameConfig accepts, with the team layout", () => {
            for (const joiners of [[b], [b, c], [b, c, d], [b, c, d, e, f]]) {
                const p = applyPendingCommand(build(a, joiners), a.id, { type: "SetLength", length: "Short" })
                .throwIfFailed();
                const config = readiness(p).throwIfFailed();
                expect(validateGameConfig(config).succeeded).toBeTrue();
                expect(config.teams).toEqual(teamLayout(p).throwIfFailed());
                expect(config.id).toBe(gameId);
                expect(config.length).toBe("Short");
            }
        });

    });


    describe("beginGame()", () => {

        it("is refused for a non-organizer", () => {
            const p = build(a, [b]);
            expect(beginGame(p, b.id, createDeck("Reduced")).throwIfSucceeded()).toEqual({ reason: "NotOrganizer" });
        });


        it("is refused with the seat count when the game is not ready", () => {
            expect(beginGame(createPending(gameId, a), a.id, createDeck("Reduced")).throwIfSucceeded())
            .toEqual({ reason: "UnsupportedPlayerCount", count: 1 });
        });


        it("gives the same result as createGame for the organizer", () => {
            const p = build(a, [b, c, d]);
            const deck = createDeck("Standard");
            const expected: Applied = createGame(readiness(p).throwIfFailed(), deck).throwIfFailed();
            expect(beginGame(p, a.id, deck).throwIfFailed()).toEqual(expected);
        });


        it("reports a deck of the wrong kind as WrongDeck", () => {
            const p = build(a, [b]);
            expect(beginGame(p, a.id, createDeck("Standard")).throwIfSucceeded()).toEqual({ reason: "WrongDeck" });
        });

    });

});
