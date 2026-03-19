import { NoneOption, SomeOption } from "./option.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";
import { type ResolutionPipelineStep, resolutionPipeline } from "./resolutionPipeline.mjs";


describe("resolutionPipeline()", () => {

    it("returns the first resolved value", async () => {
        let lastStepInvocations = 0;

        const res = await resolutionPipeline<number, string>(
            [
                () => new SucceededResult(NoneOption.get()),
                () => new SucceededResult(new SomeOption(37)),
                () => {
                    lastStepInvocations++;
                    return new SucceededResult(new SomeOption(99));
                }
            ],
            {
                onExhausted: () => "no value"
            }
        );

        expect(res).toEqual(new SucceededResult(37));
        expect(lastStepInvocations).toEqual(0);
    });


    it("returns a failed result immediately when a step hard-fails", async () => {
        let lastStepInvocations = 0;

        const res = await resolutionPipeline<number, string>(
            [
                () => new SucceededResult(NoneOption.get()),
                () => new FailedResult("hard failure"),
                () => {
                    lastStepInvocations++;
                    return new SucceededResult(new SomeOption(99));
                }
            ],
            {
                onExhausted: () => "no value"
            }
        );

        expect(res).toEqual(new FailedResult("hard failure"));
        expect(lastStepInvocations).toEqual(0);
    });


    it("returns onExhausted error when all steps return NoneOption", async () => {
        let exhaustionInvocations = 0;

        const res = await resolutionPipeline<number, string>(
            [
                () => new SucceededResult(NoneOption.get()),
                () => new SucceededResult(NoneOption.get())
            ],
            {
                onExhausted: () => {
                    exhaustionInvocations++;
                    return "exhausted";
                }
            }
        );

        expect(res).toEqual(new FailedResult("exhausted"));
        expect(exhaustionInvocations).toEqual(1);
    });


    it("supports a mix of sync and async steps", async () => {
        const steps: Array<ResolutionPipelineStep<number, string>> = [
            async () => Promise.resolve(new SucceededResult(NoneOption.get())),
            () => Promise.resolve(new SucceededResult(new SomeOption(12)))
        ];

        const res = await resolutionPipeline(
            steps,
            {
                onExhausted: () => "exhausted"
            }
        );

        expect(res).toEqual(new SucceededResult(12));
    });


    it("supports steps returned from a generator", async () => {
        function* getSteps(): Generator<ResolutionPipelineStep<number, string>> {
            yield () => new SucceededResult(NoneOption.get());
            yield () => new SucceededResult(new SomeOption(5));
        }

        const res = await resolutionPipeline(
            getSteps(),
            {
                onExhausted: () => "exhausted"
            }
        );

        expect(res).toEqual(new SucceededResult(5));
    });

});
