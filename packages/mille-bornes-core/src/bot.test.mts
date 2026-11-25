import { NoneOption, SomeOption } from "@repo/depot/option";
import { Card, type DistanceCard } from "./card.mjs";
import { type PlayerCommand } from "./commands.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { type Game, type GameConfig, type Phase } from "./game.mjs";
import { type PlayerId, type TeamIndex } from "./ids.mjs";
import { chooseCommand } from "./bot.mjs";
import { playGame, seededRandom } from "./simulation.mjs";
import { buildGame, oneOnOne, seatFor, threeByTwo, threeSolo, twoByTwo } from "./testHelpers.mjs";
import { legalPlays, viewFor, type PlayerView } from "./view.mjs";


const ann = seatFor("Ann");
const bob = seatFor("Bob");
const team0 = 0 as TeamIndex;
const team1 = 1 as TeamIndex;
const team2 = 2 as TeamIndex;


/** `chooseCommand()` with the Option unwrapped, so tests compare commands or null. */
function choose(v: PlayerView, rand?: () => number): PlayerCommand | null {
    return chooseCommand(v, rand).toNullable(null);
}


function view(g: Game, player: PlayerId): PlayerView {
    return viewFor(g, player).throwIfFailed();
}


function rollingAt(...distance: Array<DistanceCard>): DrivingZone {
    return { ...newZone(), status: { kind: "Rolling" }, distance };
}


/** A 2-seat game on Ann's turn with the given hand and zones. */
function annToPlay(
    hand: ReadonlyArray<Card>,
    zones: ReadonlyArray<DrivingZone> = [newZone(), newZone()]
): Game {
    return buildGame({ config: oneOnOne(), hands: [hand, [Card.dist25]], zones });
}


/** Ann's choice in a 2-seat game on her turn. */
function annChooses(hand: ReadonlyArray<Card>, zones?: ReadonlyArray<DrivingZone>): PlayerCommand | null {
    return choose(view(annToPlay(hand, zones), ann.id), () => 0);
}


// An Extension offer's team is always at exactly 700 miles.
const at700 = rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist100);
const at650 = rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist50);
const at550 = rollingAt(...Array<DistanceCard>(5).fill(Card.dist100), Card.dist50);
const at500 = rollingAt(Card.dist200, Card.dist200, Card.dist100);


function offerChoice(config: GameConfig, zones: ReadonlyArray<DrivingZone>, to: PlayerId):
PlayerCommand | null {
    const decider = config.teams[0]![0]!.id;
    const g = buildGame({
        config,
        zones,
        phase: { kind: "ExtensionOffer", decider, team: team0 },
    });
    return choose(view(g, to), () => 0);
}


describe("bot", () => {

    describe("chooseCommand()", () => {

        it("drives the card that completes the trip", () => {
            const zone = rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist25);
            const choice = annChooses(
                [Card.dist25, Card.dist75, Card.stop],
                [zone, newZone()]
            );
            expect(choice).toEqual({ type: "Drive", card: Card.dist75 });
        });


        it("drives the largest card that advances the trip", () => {
            expect(annChooses([Card.dist25, Card.dist100, Card.dist50], [rollingAt(), newZone()]))
            .toEqual({ type: "Drive", card: Card.dist100 });
        });


        it("drives only a 50 under a speed limit", () => {
            const limited = { ...rollingAt(), speedLimit: true };
            expect(annChooses([Card.dist100, Card.dist50], [limited, newZone()]))
            .toEqual({ type: "Drive", card: Card.dist50 });
        });


        it("plays a Coup Fourre on the target team that holds the counter", () => {
            const phase: Phase = {
                kind:     "HazardIncoming",
                attacker: bob.id,
                hazard:   Card.flatTire,
                target:   team0,
            };
            const game = (hand: ReadonlyArray<Card>): Game => buildGame({
                config: oneOnOne(),
                hands:  [hand, [Card.dist25]],
                zones:  [rollingAt(Card.dist50), newZone()],
                phase,
            });
            expect(choose(view(game([Card.punctureProof, Card.dist25]), ann.id), () => 0))
            .toEqual({ type: "CoupFourre", card: Card.punctureProof });
            expect(choose(view(game([Card.dist25]), ann.id), () => 0)).toBeNull();
            // The attacker's team has no say.
            expect(choose(view(game([Card.punctureProof]), bob.id), () => 0)).toBeNull();
        });


        it("plays Roll when the car needs one", () => {
            expect(annChooses([Card.roll, Card.dist25]))
            .toEqual({ type: "Remedy", card: Card.roll });
        });


        it("plays the remedy for the hazard showing", () => {
            const flat = { ...rollingAt(), status: { kind: "Hazard", hazard: Card.flatTire } } as const;
            expect(annChooses([Card.spareTire, Card.dist25], [flat, newZone()]))
            .toEqual({ type: "Remedy", card: Card.spareTire });
            const stopped = { ...rollingAt(), status: { kind: "Hazard", hazard: Card.stop } } as const;
            expect(annChooses([Card.roll, Card.dist25], [stopped, newZone()]))
            .toEqual({ type: "Remedy", card: Card.roll });
        });


        it("plays End of Speed Limit when no distance card can be driven", () => {
            const limited = { ...rollingAt(), speedLimit: true };
            expect(annChooses([Card.endOfSpeedLimit, Card.dist100], [limited, newZone()]))
            .toEqual({ type: "Remedy", card: Card.endOfSpeedLimit });
        });


        it("plays the safety that cancels the hazard showing", () => {
            const flat = { ...rollingAt(), status: { kind: "Hazard", hazard: Card.flatTire } } as const;
            expect(annChooses([Card.punctureProof, Card.dist25], [flat, newZone()]))
            .toEqual({ type: "PlaySafety", card: Card.punctureProof });
        });


        it("plays a safety when it has nothing better", () => {
            expect(annChooses([Card.drivingAce, Card.dist25]))
            .toEqual({ type: "PlaySafety", card: Card.drivingAce });
        });


        it("attacks the team with the most miles", () => {
            const g = buildGame({
                config: threeSolo(),
                hands:  [[Card.stop], [Card.dist25], [Card.dist25]],
                zones:  [rollingAt(), rollingAt(Card.dist100), rollingAt(Card.dist100, Card.dist200)],
            });
            expect(choose(view(g, ann.id), () => 0))
            .toEqual({ type: "Attack", card: Card.stop, targetTeam: team2 });
        });


        it("never attacks a protected team", () => {
            const protectedLeader = {
                ...rollingAt(Card.dist200, Card.dist200),
                safeties: [{ card: Card.rightOfWay, coupFourre: false }],
            };
            const g = buildGame({
                config: threeSolo(),
                hands:  [[Card.stop], [Card.dist25], [Card.dist25]],
                zones:  [rollingAt(), protectedLeader, rollingAt(Card.dist100)],
            });
            expect(choose(view(g, ann.id), () => 0))
            .toEqual({ type: "Attack", card: Card.stop, targetTeam: team2 });
        });


        it("breaks ties between equally strong targets with rand", () => {
            const g = buildGame({
                config: threeSolo(),
                hands:  [[Card.stop], [Card.dist25], [Card.dist25]],
                zones:  [rollingAt(), rollingAt(Card.dist100), rollingAt(Card.dist100)],
            });
            const v = view(g, ann.id);
            expect(choose(v, () => 0)).toEqual({ type: "Attack", card: Card.stop, targetTeam: team1 });
            expect(choose(v, () => 0.99))
            .toEqual({ type: "Attack", card: Card.stop, targetTeam: team2 });
        });


        it("discards when nothing else can be played", () => {
            expect(annChooses([Card.dist25, Card.dist50])).toEqual({ type: "Discard", card: Card.dist25 });
        });


        it("discards a hazard that no one can be attacked with before a distance card", () => {
            const protectedBob = {
                ...rollingAt(),
                safeties: [{ card: Card.punctureProof, coupFourre: false }],
            };
            expect(annChooses([Card.dist25, Card.flatTire, Card.dist50], [newZone(), protectedBob]))
            .toEqual({ type: "Discard", card: Card.flatTire });
        });


        it("discards a remedy that its own safety makes useless first", () => {
            const rightOfWay = {
                ...rollingAt(),
                safeties: [{ card: Card.rightOfWay, coupFourre: false }],
            };
            expect(annChooses([Card.spareTire, Card.roll], [rightOfWay, newZone()]))
            .toEqual({ type: "Discard", card: Card.roll });
        });


        it("discards a duplicate before a single card", () => {
            expect(annChooses([Card.spareTire, Card.endOfSpeedLimit, Card.spareTire], [rollingAt(), newZone()]))
            .toEqual({ type: "Discard", card: Card.spareTire });
        });


        it("discards a distance card that can never be played", () => {
            const discards200 = (zone: DrivingZone): PlayerCommand | null => {
                const g = buildGame({
                    config:    oneOnOne(),
                    hands:     [[Card.spareTire, Card.dist200], [Card.dist25]],
                    zones:     [zone, newZone()],
                    extension: { kind: "Called", caller: team0 },
                });
                return choose(view(g, ann.id), () => 0);
            };
            const discard200 = { type: "Discard", card: Card.dist200 };
            // A third 200, and a 200 that overshoots the 1,000-mile trip.
            expect(discards200(
                rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist100)
            )).toEqual(discard200 as PlayerCommand);
            expect(discards200(rollingAt(...Array<DistanceCard>(9).fill(Card.dist100))))
            .toEqual(discard200 as PlayerCommand);
        });


        it("returns null when it is not the robot's turn", () => {
            expect(choose(view(annToPlay([Card.dist25]), bob.id), () => 0)).toBeNull();
        });


        it("returns a some option holding the command, or a none option", () => {
            const v = view(annToPlay([Card.dist25], [rollingAt(), newZone()]), ann.id);
            const drive: PlayerCommand = { type: "Drive", card: Card.dist25 };
            expect(chooseCommand(v, () => 0)).toEqual(new SomeOption(drive));
            expect(chooseCommand(view(annToPlay([Card.dist25]), bob.id), () => 0)).toBe(NoneOption.get());
        });


        describe("Extension offer", () => {

            it("calls Extension with a 150-mile lead", () => {
                expect(offerChoice(oneOnOne(), [at700, at550], ann.id)).toEqual({ type: "CallExtension" });
            });


            it("calls Extension with exactly a 100-mile lead", () => {
                const at600 = rollingAt(...Array<DistanceCard>(6).fill(Card.dist100));
                expect(offerChoice(oneOnOne(), [at700, at600], ann.id)).toEqual({ type: "CallExtension" });
            });


            it("declines Extension with a 50-mile lead", () => {
                expect(offerChoice(oneOnOne(), [at700, at650], ann.id))
                .toEqual({ type: "DeclineExtension" });
            });


            it("makes no decision when the offer is for someone else", () => {
                expect(offerChoice(oneOnOne(), [at700, at550], bob.id)).toBeNull();
            });


            it("makes no decision for a teammate of the decider", () => {
                const di = seatFor("Di");
                expect(offerChoice(threeByTwo(), [at700, at550, at500], di.id)).toBeNull();
            });


            it("needs a lead of at least 100 over every other team", () => {
                expect(offerChoice(threeSolo(), [at700, at550, at650], ann.id))
                .toEqual({ type: "DeclineExtension" });
                expect(offerChoice(threeSolo(), [at700, at550, at500], ann.id))
                .toEqual({ type: "CallExtension" });
                expect(offerChoice(threeByTwo(), [at700, at500, at550], ann.id))
                .toEqual({ type: "CallExtension" });
            });

        });


        it("is deterministic for a fixed rand", () => {
            const v = view(annToPlay([Card.dist25, Card.dist50, Card.spareTire]), ann.id);
            const first = choose(v, () => 0.5);
            for (let i = 0; i < 5; i++) {
                expect(choose(v, () => 0.5)).toEqual(first);
            }
        });


        it("still makes a legal play on its turn when rand is out of range", () => {
            const attackTie = buildGame({
                config: threeSolo(),
                hands:  [[Card.stop], [Card.dist25], [Card.dist25]],
                zones:  [rollingAt(), rollingAt(Card.dist100), rollingAt(Card.dist100)],
            });
            const views = [view(attackTie, ann.id), view(annToPlay([Card.dist25, Card.dist50]), ann.id)];
            for (const v of views) {
                for (const rand of [(): number => NaN, (): number => -1, (): number => 1]) {
                    const choice = choose(v, rand);
                    expect(choice).not.toBeNull();
                    expect(legalPlays(v)).toContain(choice!);
                }
            }
        });


        it("always gives a legal command, and never gets stuck, in whole robot games", () => {
            // playGame() fails on any robot answer not in legalPlays(view), on
            // a robot with no play on its turn, and after 5,000 steps.
            const configs: ReadonlyArray<() => GameConfig> = [oneOnOne, threeSolo, twoByTwo, threeByTwo];
            for (const config of configs) {
                for (const length of ["Quick", "Short"] as const) {
                    for (let seed = 1; seed <= 4; seed++) {
                        const label = `${config.name}, ${length}, seed ${seed}`;
                        const result = playGame({ ...config(), length }, seededRandom(seed), 5000, { label });
                        expect(result.failed ? result.error : "").toBe("");
                    }
                }
            }
        });

    });

});
