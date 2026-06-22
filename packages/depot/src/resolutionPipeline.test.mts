import { FailedResult, SucceededResult } from "./result.mjs";
import {
    type ResolutionPipelineStep,
    type ResolutionPipelineStepAsync,
    pipelineStep,
    pipelineTerminate,
    resolutionPipeline,
    resolutionPipelineAsync
} from "./resolutionPipeline.mjs";


describe("resolutionPipelineAsync()", () => {

    it("returns the first resolved value", async () => {
        let lastStepInvocations = 0;

        const res = await resolutionPipelineAsync<number, string>(
            [
                () => pipelineStep("step 1 failed"),
                () => new SucceededResult(37),
                () => {
                    lastStepInvocations++;
                    return new SucceededResult(99);
                }
            ],
            {
                onExhausted: (errors) => errors.join("; ")
            }
        );

        expect(res).toEqual(new SucceededResult(37));
        expect(lastStepInvocations).toEqual(0);
    });


    it("returns a failed result immediately when a step terminates", async () => {
        let lastStepInvocations = 0;

        const res = await resolutionPipelineAsync<number, string>(
            [
                () => pipelineStep("step 1 failed"),
                () => pipelineTerminate("hard failure"),
                () => {
                    lastStepInvocations++;
                    return new SucceededResult(99);
                }
            ],
            {
                onExhausted: (errors) => errors.join("; ")
            }
        );

        expect(res).toEqual(new FailedResult("hard failure"));
        expect(lastStepInvocations).toEqual(0);
    });


    it("returns onExhausted error with accumulated step errors when all steps fail", async () => {
        let exhaustionInvocations = 0;

        const res = await resolutionPipelineAsync<number, string>(
            [
                () => pipelineStep("first failed"),
                () => pipelineStep("second failed")
            ],
            {
                onExhausted: (errors) => {
                    exhaustionInvocations++;
                    return errors.join("; ");
                }
            }
        );

        expect(res).toEqual(new FailedResult("first failed; second failed"));
        expect(exhaustionInvocations).toEqual(1);
    });


    it("supports a mix of sync and async steps", async () => {
        const steps: Array<ResolutionPipelineStepAsync<number, string>> = [
            async () => Promise.resolve(pipelineStep("async step failed")),
            () => Promise.resolve(new SucceededResult(12))
        ];

        const res = await resolutionPipelineAsync(
            steps,
            {
                onExhausted: (errors) => errors.join("; ")
            }
        );

        expect(res).toEqual(new SucceededResult(12));
    });


    it("supports steps returned from a generator", async () => {
        function* getSteps(): Generator<ResolutionPipelineStepAsync<number, string>> {
            yield () => pipelineStep("step 1 failed");
            yield () => new SucceededResult(5);
        }

        const res = await resolutionPipelineAsync(
            getSteps(),
            {
                onExhausted: (errors) => errors.join("; ")
            }
        );

        expect(res).toEqual(new SucceededResult(5));
    });

});


describe("resolutionPipeline()", () => {

    it("returns the first resolved value", () => {
        let lastStepInvocations = 0;

        const res = resolutionPipeline<number, string>(
            [
                () => pipelineStep("step 1 failed"),
                () => new SucceededResult(37),
                () => {
                    lastStepInvocations++;
                    return new SucceededResult(99);
                }
            ],
            {
                onExhausted: (errors) => errors.join("; ")
            }
        );

        expect(res).toEqual(new SucceededResult(37));
        expect(lastStepInvocations).toEqual(0);
    });


    it("returns a failed result immediately when a step terminates", () => {
        let lastStepInvocations = 0;

        const res = resolutionPipeline<number, string>(
            [
                () => pipelineStep("step 1 failed"),
                () => pipelineTerminate("hard failure"),
                () => {
                    lastStepInvocations++;
                    return new SucceededResult(99);
                }
            ],
            {
                onExhausted: (errors) => errors.join("; ")
            }
        );

        expect(res).toEqual(new FailedResult("hard failure"));
        expect(lastStepInvocations).toEqual(0);
    });


    it("returns onExhausted error with accumulated step errors when all steps fail", () => {
        let exhaustionInvocations = 0;

        const res = resolutionPipeline<number, string>(
            [
                () => pipelineStep("first failed"),
                () => pipelineStep("second failed")
            ],
            {
                onExhausted: (errors) => {
                    exhaustionInvocations++;
                    return errors.join("; ");
                }
            }
        );

        expect(res).toEqual(new FailedResult("first failed; second failed"));
        expect(exhaustionInvocations).toEqual(1);
    });


    it("supports steps returned from a generator", () => {
        function* getSteps(): Generator<ResolutionPipelineStep<number, string>> {
            yield () => pipelineStep("step 1 failed");
            yield () => new SucceededResult(5);
        }

        const res = resolutionPipeline(
            getSteps(),
            {
                onExhausted: (errors) => errors.join("; ")
            }
        );

        expect(res).toEqual(new SucceededResult(5));
    });

});
