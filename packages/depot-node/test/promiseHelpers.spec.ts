import {EventEmitter} from "events";
import {eventToPromise} from "../src/promiseHelpers.js";
import {getTimerPromise} from "../..//depot/src/promiseHelpers.js";


describe("eventToPromise()", () => {
    const ee = new EventEmitter();


    it("will resolve with the resolve event's payload", (done) => {
        eventToPromise(ee, "resolve", "reject")
        .then((result) => {
            expect(result).toEqual(5);
            done();
        });

        ee.emit("resolve", 5);
    });


    it("once resolved, there will be no listeners", (done) => {
        eventToPromise(ee, "resolve", "reject")
        .then(() => {
            expect(ee.listenerCount("resolve")).toEqual(0);
            expect(ee.listenerCount("reject")).toEqual(0);
            done();
        });

        ee.emit("resolve", 5);
    });


    it("other events will not cause the returned promise to resolve or reject", (done) => {
        let promiseResolved = false;
        let promiseRejected = false;
        eventToPromise(ee, "resolve", "reject")
        .then(
            () => {
                promiseResolved = true;
            },
            () => {
                promiseRejected = true;
            }
        );

        ee.emit("other", 5);
        getTimerPromise(10, 0)
        .then(() => {
            expect(promiseResolved).toEqual(false);
            expect(promiseRejected).toEqual(false);
            done();
        });
    });


    it("will reject with the reject event's payload", (done) => {
        eventToPromise(ee, "resolve", "reject")
        .catch((err) => {
            expect(err).toEqual("error message");
            done();
        });

        ee.emit("reject", "error message");
    });


    it("once rejected, there will be no listeners", (done) => {
        eventToPromise(ee, "resolve", "reject")
        .catch(() => {
            expect(ee.listenerCount("resolve")).toEqual(0);
            expect(ee.listenerCount("reject")).toEqual(0);
            done();
        });

        ee.emit("reject", "error message");
    });


});
