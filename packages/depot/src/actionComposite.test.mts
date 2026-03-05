import {Action} from "./action.mjs";
import {ActionComposite} from "./actionComposite.mjs";
import { getTimerPromise } from "./promiseHelpers.mjs";


describe("ActionComposite", () => {


    it("can be constructed", () => {
        const ac = new ActionComposite();
        expect(ac).not.toBeNull();
    });


    describe("description property", () => {

        it("contains placeholder text for actions with no description", () => {
            const ac = new ActionComposite();
            ac.add(new Action(() => {
                // Intentionally empty.
            }));
            ac.add(new Action(() => {
                // Intentionally empty.
            }, "action2"));
            ac.add(new Action(() => {
                // Intentionally empty.
            }));
            expect(ac.description).toEqual("<action>\naction2\n<action>");
        });

    });


    describe("length property", () => {


        it("returns zero when empty", () => {
            const ac = new ActionComposite();
            expect(ac.length).toEqual(0);
        });


        it("return correct number when not empty", () => {
            const ac = new ActionComposite()
            .add(
                new Action(() => {
                    // Intentionally empty.
                }),
                new Action(() => {
                    // Intentionally empty.
                }),
                new Action(() => {
                    // Intentionally empty.
                })
            );
            expect(ac.length).toEqual(3);
        });


    });


    describe("execute()", () => {


        it("with zero actions completes successfully", (done) => {
            const ac = new ActionComposite();
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ac.execute()
            .then(() => {
                done();
            });
        });


        it("returns a rejected promise when one of the actions rejects", (done) => {
            const ac = new ActionComposite();
            ac.add(new Action(() => {
                return getTimerPromise(20, 1)
                .then(() => {
                    // Intentionally empty.
                });
            }));

            ac.add(new Action(() => {
                return getTimerPromise(10, 2)
                .then(() => {
                    throw new Error("Error message.");
                });
            }));

            ac.execute()
            .catch((err: unknown) => {
                expect(err instanceof Error).toBeTrue();
                if (err instanceof Error) {
                    expect(err.message).toEqual("Error message.");
                }
                done();
            });
        });


        it("returns a resolved promise when all actions resolve", (done) => {
            const ac = new ActionComposite();

            let action1Done = false;
            ac.add(new Action(() => {
                return getTimerPromise(20, 1)
                .then(() => {
                    action1Done = true;
                });
            }));

            let action2Done = false;
            ac.add(new Action(() => {
                return getTimerPromise(10, 2)
                .then(() => {
                    action2Done = true;
                });
            }));

            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ac.execute()
            .then(() => {
                expect(action1Done).toBeTruthy();
                expect(action2Done).toBeTruthy();
                done();
            });
        });


    });

});
