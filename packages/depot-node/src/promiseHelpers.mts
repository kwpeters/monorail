import {Writable} from "stream";
import {EventEmitter} from "events";
import {ListenerTracker} from "./listenerTracker.mjs";


/**
 * Adapts an EventEmitter to a Promise interface
 * @param emitter - The event emitter to listen to
 * @param resolveEventName - The event that will cause the Promise to resolve
 * @param rejectEventName - The event that will cause the Promise to reject
 * @return A Promise that will will resolve and reject as specified
 */
export function eventToPromise<TResolve>(
    emitter: EventEmitter,
    resolveEventName: string,
    rejectEventName?: string
): Promise<TResolve> {
    return new Promise<TResolve>(
        (resolve: (result: TResolve) => void, reject: (err: unknown) => void) => {
            const tracker = new ListenerTracker(emitter);

            tracker.once(resolveEventName, (result: TResolve) => {
                tracker.removeAll();
                resolve(result);
            });

            if (rejectEventName) {
                tracker.once(rejectEventName, (err: unknown) => {
                    tracker.removeAll();
                    reject(err);
                });
            }
        }
    );
}


/**
 * Adapts a stream to a Promise interface.
 * @param stream - The stream to be adapted
 * @return A Promise that will be resolved when the stream emits the "finish"
 * event and rejects when it emits an "error" event.
 */
export function streamToPromise(stream: Writable): Promise<void> {
    return eventToPromise(stream, "finish", "error");
}
