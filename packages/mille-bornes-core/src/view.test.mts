import { Card, safetyCardSchema, type DistanceCard } from "./card.mjs";
import { type PlayerCommand } from "./commands.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { applyPlayerCommand, createGame } from "./engine.mjs";
import { type Game, type GameConfig, type Phase } from "./game.mjs";
import { type PlayerId, type TeamIndex } from "./ids.mjs";
import { type Miles } from "./miles.mjs";
import { Points } from "./points.mjs";
import { type Rejection } from "./rejection.mjs";
import { checkCommand, contextFromGame, contextFromView } from "./rules.mjs";
import { scoreRace, standardScoring, type RaceOutcome } from "./scoring.mjs";
import {
    buildGame, deckFor, oneOnOne, seatFor, threeSolo, twoByTwo, type GameParts
} from "./testHelpers.mjs";
import { candidateCommands, eventsFor, legalPlays, viewFor, type PlayerView } from "./view.mjs";


const ann = seatFor("Ann");
const bob = seatFor("Bob");
const cy = seatFor("Cy");
const di = seatFor("Di");
const team0 = 0 as TeamIndex;
const team1 = 1 as TeamIndex;
const team2 = 2 as TeamIndex;


function view(g: Game, player: PlayerId): PlayerView {
    return viewFor(g, player).throwIfFailed();
}


function rollingAt(...distance: Array<DistanceCard>): DrivingZone {
    return { ...newZone(), status: { kind: "Rolling" }, distance };
}


function raceOverPhase(teamCount: number, winner?: TeamIndex): Phase {
    const outcome: RaceOutcome = { kind: "Exhausted", winner: "Tie", extensionCaller: null };
    const zones = Array.from({ length: teamCount }, () => newZone());
    const points = zones.map(() => Points.zero);
    const result = { outcome, scores: scoreRace(standardScoring, zones, outcome, points) };
    return winner === undefined ?
        { kind: "RaceOver", result } :
        { kind: "GameOver", winner, result };
}


// The leak fixture: three solo seats, Bob a robot.  Each hand holds one of the
// single-copy safeties and the fourth is in the draw pile, so a safety's name
// in a view can only come from a hand or the draw pile.
const leakSeats = [ann, seatFor("Bob", "Robot"), cy];
const secretOf: ReadonlyMap<PlayerId, Card> = new Map([
    [ann.id, Card.drivingAce],
    [bob.id, Card.extraTank],
    [cy.id, Card.punctureProof],
]);
const leakPhases: ReadonlyArray<Phase> = [
    { kind: "Turn", player: ann.id },
    { kind: "HazardIncoming", attacker: bob.id, hazard: Card.stop, target: team0 },
    { kind: "ExtensionOffer", decider: cy.id, team: team2 },
    raceOverPhase(3),
    raceOverPhase(3, team1),
];


function leakGame(phase: Phase): Game {
    return buildGame({
        config: { ...threeSolo(), teams: leakSeats.map((seat) => [seat]) },
        hands:  [
            [Card.drivingAce, Card.dist25, Card.roll],
            [Card.extraTank, Card.dist50, Card.stop],
            [Card.punctureProof, Card.dist75, Card.repairs],
        ],
        drawPile: [Card.rightOfWay, Card.dist100],
        phase,
    });
}


/** A 2-seat game where Ann's team is at 625 miles with a Coup Fourré. */
function annAt625(parts: Partial<GameParts> = {}): Game {
    return buildGame({
        config: oneOnOne(),
        hands:  [[Card.dist75, Card.roll], [Card.dist25, Card.stop]],
        zones:  [
            {
                ...rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist25),
                safeties: [{ card: Card.drivingAce, coupFourre: true }],
            },
            rollingAt(Card.dist50),
        ],
        drawPile: [Card.dist100, Card.dist50],
        ...parts,
    });
}


function play(g: Game, by: PlayerId, cmd: PlayerCommand): Game {
    return applyPlayerCommand(g, by, cmd).throwIfFailed().game;
}


const drive75: PlayerCommand = { type: "Drive", card: Card.dist75 };
const callExtension: PlayerCommand = { type: "CallExtension" };
const declineExtension: PlayerCommand = { type: "DeclineExtension" };


/** A 4-seat game where Bob has played an Accident on Ann's team. */
function accidentOnAnnsTeam(): Game {
    return buildGame({
        config: twoByTwo(),
        hands:  [
            [Card.extraTank, Card.dist25],
            [Card.dist50, Card.stop],
            [Card.drivingAce, Card.rightOfWay],
            [Card.roll],
        ],
        zones: [rollingAt(Card.dist50), newZone()],
        phase: { kind: "HazardIncoming", attacker: bob.id, hazard: Card.accident, target: team0 },
    });
}


/** A 2-seat game on Ann's turn, Ann holding a Roll and a 75. */
function annNeedsRoll(): Game {
    return buildGame({
        config: oneOnOne(),
        hands:  [[Card.roll, Card.dist75, Card.stop], [Card.dist25, Card.accident]],
    });
}


function offerTo(decider: PlayerId, team: TeamIndex): Game {
    return buildGame({
        config: oneOnOne(),
        hands:  [[Card.roll, Card.dist25], [Card.dist50]],
        phase:  { kind: "ExtensionOffer", decider, team },
    });
}


const seatKeys = ["handSize", "id", "isMe", "name", "team"];


describe("view", () => {

    describe("viewFor()", () => {

        it("shows the viewer's own hand and every seat's public facts", () => {
            const g = leakGame(leakPhases[0]!);
            const v = view(g, bob.id);
            expect(v.me).toEqual({ id: bob.id, name: bob.name, team: team1, hand: g.players[1]!.hand });
            expect(v.seats).toEqual(g.players.map((p) => ({
                id:       p.seat.id,
                name:     p.seat.name,
                team:     p.team,
                handSize: p.hand.length,
                isMe:     p.seat.id === bob.id,
            })));
            expect(v.gameId).toBe(g.config.id);
            expect(v.raceNumber).toBe(1);
            expect(v.length).toBe("Full");
            expect(v.teams).toEqual(g.teams.map((t, i) => ({
                index:  i as TeamIndex,
                zone:   t.zone,
                points: t.points,
            })));
            expect(v.drawPileCount).toBe(2);
            expect(v.discardTop).toBe(g.discardPile.at(-1)!);
            expect(v.phase).toEqual({ kind: "Turn", player: ann.id });
        });


        it("shows no discard top when the discard pile is empty", () => {
            const g = createGame(oneOnOne(), deckFor([], [], "Reduced")).throwIfFailed().game;
            expect(view(g, ann.id).discardTop).toBeNull();
        });


        it("never leaks another hand, the draw pile or a seat's kind", () => {
            for (const phase of leakPhases) {
                const g = leakGame(phase);
                // Otherwise a secret could be public and the test vacuous.
                expect(safetyCardSchema.safeParse(g.discardPile.at(-1)).success).toBeFalse();
                for (const { seat } of g.players) {
                    const context = `${phase.kind}, viewed by ${seat.name}`;
                    const v = view(g, seat.id);
                    const json = JSON.stringify(v);
                    for (const [owner, secret] of secretOf) {
                        expect(json.includes(`"${secret}"`)).withContext(`${context}: ${secret}`)
                        .toBe(owner === seat.id);
                    }
                    expect(json).withContext(context).not.toContain(`"${Card.rightOfWay}"`);
                    expect(json).withContext(context).not.toContain("\"drawPile\"");
                    expect(json.split("\"hand\":").length).withContext(context).toBe(2);
                    expect(Object.keys(v.me).sort()).withContext(context)
                    .toEqual(["hand", "id", "name", "team"]);
                    for (const s of v.seats) {
                        expect(Object.keys(s).sort()).withContext(context).toEqual(seatKeys);
                    }

                    const parsed = JSON.parse(json) as { phase: Record<string, unknown> };
                    if (phase.kind === "GameOver") {
                        expect(parsed.phase.reveal).toEqual(g.players.map((p) => ({
                            id:   p.seat.id,
                            name: p.seat.name,
                            kind: p.seat.kind,
                        })));
                        expect(json).toContain("\"Robot\"");
                        delete parsed.phase.reveal;
                    }
                    const unrevealed = JSON.stringify(parsed);
                    expect(unrevealed).withContext(context).not.toContain("\"reveal\"");
                    expect(unrevealed).withContext(context).not.toContain("\"Robot\"");
                    expect(unrevealed).withContext(context).not.toContain("\"Human\"");
                }
            }
        });


        it("shows the same hazard window to every player", () => {
            const g = accidentOnAnnsTeam();
            for (const { seat } of g.players) {
                expect(view(g, seat.id).phase).withContext(seat.name).toEqual({
                    kind:     "HazardIncoming",
                    attacker: bob.id,
                    hazard:   Card.accident,
                    target:   team0,
                });
            }
        });


        it("shows the full score sheet and the finished zones after a race", () => {
            for (const length of ["Full", "Quick"] as const) {
                const offered = play(annAt625({ config: { ...oneOnOne(), length } }), ann.id, drive75);
                const over = play(offered, ann.id, declineExtension);
                expect(over.phase.kind).toBe(length === "Full" ? "RaceOver" : "GameOver");
                for (const { seat } of over.players) {
                    const v = view(over, seat.id);
                    if (v.phase.kind !== "RaceOver" && v.phase.kind !== "GameOver") {
                        throw new Error(`Unexpected phase ${v.phase.kind}.`);
                    }
                    const { scores } = v.phase.result;
                    expect(scores.length).toBe(2);
                    for (const score of scores) {
                        expect(Object.keys(score)).toEqual(jasmine.arrayWithExactContents([
                            "broughtForward", "miles", "milestones", "safetyCount", "safeties",
                            "coupFourreCount", "coupFourres", "tripCompleted", "delayedAction",
                            "safeTrip", "shutout", "extension", "totalForRace", "combinedTotal",
                        ]));
                    }
                    expect(scores[0]!.miles).toBe(700 as Miles);
                    expect(scores[0]!.coupFourreCount).toBe(1);
                    expect(v.teams.map((t) => t.zone)).toEqual(over.teams.map((t) => t.zone));
                    expect(v.teams[0]!.zone.distance.length).toBe(6);
                    expect(v.teams[0]!.zone.safeties)
                    .toEqual([{ card: Card.drivingAce, coupFourre: true }]);
                    expect(v.teams[1]!.zone.distance).toEqual([Card.dist50]);
                    expect(v.teams.map((t) => t.points)).toEqual(scores.map((s) => s.combinedTotal));
                }
            }
        });


        it("reveals every seat's kind at the end of the game", () => {
            const g = leakGame(leakPhases[4]!);
            const v = view(g, ann.id);
            expect(v.phase).toEqual({
                ...(g.phase as Extract<Phase, { kind: "GameOver" }>),
                reveal: [
                    { id: ann.id, name: ann.name, kind: "Human" },
                    { id: bob.id, name: bob.name, kind: "Robot" },
                    { id: cy.id, name: cy.name, kind: "Human" },
                ],
            });
        });


        it("shows the trip distance in force", () => {
            const twoSeats = createGame(oneOnOne(), deckFor([], [], "Reduced")).throwIfFailed().game;
            expect(view(twoSeats, ann.id).trip)
            .toEqual({ distance: 700 as Miles, extension: { kind: "Available" } });

            const called = play(play(annAt625(), ann.id, drive75), ann.id, callExtension);
            expect(view(called, bob.id).trip)
            .toEqual({ distance: 1000 as Miles, extension: { kind: "Called", caller: team0 } });

            const fourSeats = createGame(twoByTwo(), deckFor([])).throwIfFailed().game;
            expect(view(fourSeats, di.id).trip)
            .toEqual({ distance: 1000 as Miles, extension: { kind: "NotApplicable" } });
        });


        it("refuses a player who is not in the game", () => {
            expect(viewFor(leakGame(leakPhases[0]!), seatFor("Zed").id).throwIfSucceeded())
            .toEqual({ reason: "WrongPhase" });
        });

    });


    describe("eventsFor()", () => {

        it("shows a drawn card only to the drawer", () => {
            const { events } = createGame(oneOnOne(), deckFor([], [], "Reduced")).throwIfFailed();
            const drawn = events.find((e) => e.type === "CardDrawn")!;
            expect(drawn.player).toBe(ann.id);
            expect(drawn.card).not.toBeNull();
            expect(eventsFor(ann.id, events)).toEqual(events);
            expect(eventsFor(bob.id, events))
            .toEqual(events.map((e) => e.type === "CardDrawn" ? { ...e, card: null } : e));
        });

    });


    describe("contextFromView()", () => {

        it("matches the engine's context in every phase", () => {
            const games = [
                ...leakPhases.map(leakGame),
                accidentOnAnnsTeam(),
                offerTo(bob.id, team1),
                play(play(annAt625(), ann.id, drive75), ann.id, callExtension),
            ];
            for (const g of games) {
                for (const { seat } of g.players) {
                    expect(contextFromView(view(g, seat.id)))
                    .withContext(`${g.phase.kind}, ${seat.name}`)
                    .toEqual(contextFromGame(g, seat.id).throwIfFailed());
                }
            }
        });


        it("refuses scripted commands exactly as the engine does", () => {
            const at625 = annAt625({ hands: [[Card.dist100, Card.dist25], [Card.dist25]] });
            const nineFifty = rollingAt(
                Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist100, Card.dist100,
                Card.dist100, Card.dist50
            );
            const at950 = buildGame({
                config:    oneOnOne(),
                hands:     [[Card.dist100], [Card.dist25]],
                zones:     [nineFifty, newZone()],
                extension: { kind: "Called", caller: team0 },
            });
            const window = accidentOnAnnsTeam();
            const offer = offerTo(ann.id, team0);
            const over = leakGame(leakPhases[3]!);
            const scripted: ReadonlyArray<[Game, PlayerId, PlayerCommand]> = [
                [annNeedsRoll(), bob.id, { type: "Discard", card: Card.dist25 }],
                [annNeedsRoll(), ann.id, drive75],
                [annNeedsRoll(), ann.id, { type: "Discard", card: Card.accident }],
                [annNeedsRoll(), ann.id, { type: "Attack", card: Card.stop, targetTeam: team0 }],
                [annNeedsRoll(), ann.id, { type: "Attack", card: Card.stop, targetTeam: team1 }],
                [annNeedsRoll(), ann.id, { type: "CoupFourre", card: Card.drivingAce }],
                [annNeedsRoll(), ann.id, callExtension],
                [annNeedsRoll(), ann.id, { type: "Drive", card: Card.roll } as unknown as PlayerCommand],
                [at625, ann.id, { type: "Drive", card: Card.dist100 }],
                [at950, ann.id, { type: "Drive", card: Card.dist100 }],
                [window, ann.id, { type: "Discard", card: Card.dist25 }],
                [window, bob.id, { type: "CoupFourre", card: Card.drivingAce }],
                [window, ann.id, { type: "CoupFourre", card: Card.extraTank }],
                [window, ann.id, { type: "CoupFourre", card: Card.drivingAce }],
                [offer, bob.id, callExtension],
                [offer, ann.id, { type: "Discard", card: Card.roll }],
                [offer, bob.id, { type: "Discard", card: Card.dist50 }],
                [over, ann.id, { type: "Discard", card: Card.roll }],
            ];
            for (const [g, by, cmd] of scripted) {
                const engine = applyPlayerCommand(g, by, cmd).throwIfSucceeded();
                expect(checkCommand(contextFromView(view(g, by)), cmd).throwIfSucceeded())
                .withContext(JSON.stringify(cmd))
                .toEqual(engine);
            }
            expect(applyPlayerCommand(at950, ann.id, { type: "Drive", card: Card.dist100 }).error)
            .toEqual({ reason: "WouldOvershoot", remaining: 50, trip: 1000 } as Rejection);
        });

    });


    describe("candidateCommands()", () => {

        it("offers every well-formed command once per distinct card", () => {
            const g = buildGame({
                config: threeSolo(),
                hands:  [[Card.dist75, Card.dist75, Card.roll, Card.drivingAce, Card.accident], [], []],
            });
            expect(candidateCommands(view(g, ann.id))).toEqual(jasmine.arrayWithExactContents([
                { type: "Drive", card: Card.dist75 },
                { type: "Discard", card: Card.dist75 },
                { type: "Remedy", card: Card.roll },
                { type: "Discard", card: Card.roll },
                { type: "PlaySafety", card: Card.drivingAce },
                { type: "CoupFourre", card: Card.drivingAce },
                { type: "Discard", card: Card.drivingAce },
                { type: "Attack", card: Card.accident, targetTeam: team1 },
                { type: "Attack", card: Card.accident, targetTeam: team2 },
                { type: "Discard", card: Card.accident },
            ]));
        });


        it("offers the Extension decision only to the decider", () => {
            const g = offerTo(ann.id, team0);
            expect(candidateCommands(view(g, ann.id))).toEqual(jasmine.arrayWithExactContents([
                { type: "Remedy", card: Card.roll },
                { type: "Discard", card: Card.roll },
                { type: "Drive", card: Card.dist25 },
                { type: "Discard", card: Card.dist25 },
                callExtension,
                declineExtension,
            ]));
            expect(candidateCommands(view(g, bob.id)))
            .toEqual([{ type: "Drive", card: Card.dist50 }, { type: "Discard", card: Card.dist50 }]);
        });

    });


    describe("legalPlays()", () => {

        it("offers a Roll and every Discard, but no Drive, to a car that needs a Roll", () => {
            const g = buildGame({ config: oneOnOne(), hands: [[Card.roll, Card.dist75], [Card.dist25]] });
            expect(legalPlays(view(g, ann.id))).toEqual(jasmine.arrayWithExactContents([
                { type: "Remedy", card: Card.roll },
                { type: "Discard", card: Card.roll },
                { type: "Discard", card: Card.dist75 },
            ]));
        });


        it("offers only the Extension decision, and only to the decider", () => {
            const g = offerTo(ann.id, team0);
            expect(legalPlays(view(g, ann.id)))
            .toEqual(jasmine.arrayWithExactContents([callExtension, declineExtension]));
            expect(legalPlays(view(g, bob.id))).toEqual([]);
        });


        it("offers a Coup Fourré only to a target-team member holding the counter", () => {
            const g = accidentOnAnnsTeam();
            expect(legalPlays(view(g, cy.id))).toEqual([{ type: "CoupFourre", card: Card.drivingAce }]);
            for (const player of [ann, bob, di]) {
                expect(legalPlays(view(g, player.id))).withContext(player.name).toEqual([]);
            }
        });


        it("offers exactly the candidates the engine accepts", () => {
            const games = [
                ...leakPhases.map(leakGame),
                accidentOnAnnsTeam(),
                annNeedsRoll(),
                annAt625(),
                offerTo(ann.id, team0),
            ];
            for (const g of games) {
                for (const { seat } of g.players) {
                    const v = view(g, seat.id);
                    const legal = legalPlays(v).map((cmd) => JSON.stringify(cmd));
                    for (const cmd of candidateCommands(v)) {
                        expect(legal.includes(JSON.stringify(cmd)))
                        .withContext(`${g.phase.kind}, ${seat.name}: ${JSON.stringify(cmd)}`)
                        .toBe(applyPlayerCommand(g, seat.id, cmd).succeeded);
                    }
                }
            }
        });

    });

});
