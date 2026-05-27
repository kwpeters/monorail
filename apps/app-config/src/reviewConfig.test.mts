import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { expandDeployedPathEnvVars, parseReviewConfig } from "./reviewConfig.mjs";


describe("expandDeployedPathEnvVars", () => {

    it("expands placeholder values", () => {
        const envVarName = "APP_CONFIG_TEST_VAR";
        process.env[envVarName] = "value123";
        const placeholder = "$" + "{" + envVarName + "}";

        const result = expandDeployedPathEnvVars(placeholder + "/target.txt");

        expect(result.succeeded).toBeTrue();
        if (result.succeeded) {
            expect(result.value).toContain("value123");
        }
    });


    it("fails for missing env vars", () => {
        const envVarName = "APP_CONFIG_MISSING_" + Date.now().toString();
        const placeholder = "$" + "{" + envVarName + "}";

        const result = expandDeployedPathEnvVars(placeholder + "/target.txt");

        expect(result.failed).toBeTrue();
    });


    it("rejects %VAR% syntax", () => {
        const result = expandDeployedPathEnvVars("%USERPROFILE%/target.txt");
        expect(result.failed).toBeTrue();
    });


    it("rejects $VAR syntax", () => {
        const result = expandDeployedPathEnvVars("$USERPROFILE/target.txt");
        expect(result.failed).toBeTrue();
    });
});


describe("parseReviewConfig", () => {

    it("parses JSONC with comments and trailing commas", async () => {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "app-config-test-"));
        const repoRoot = new Directory(tempRoot);

        const repoFile = new File(repoRoot, "configs/git/.gitconfig");
        await repoFile.write("[user]\n  name = test\n");

        const envVarName = "APP_CONFIG_TEST_DEPLOYED";
        process.env[envVarName] = path.join(tempRoot, "deployed");
        const placeholder = "$" + "{" + envVarName + "}";

        const configFile = new File(repoRoot, "review.jsonc");
        await configFile.write(
            [
                "{",
                "  // comment is allowed",
                "  \"mappings\": [",
                "    {",
                "      \"repoRelativePath\": \"configs/git/.gitconfig\",",
                "      \"deployedAbsolutePath\": \"" + placeholder + "/.gitconfig\",",
                "    }",
                "  ]",
                "}"
            ].join("\n")
        );

        const result = await parseReviewConfig(configFile, repoRoot);

        expect(result.succeeded).toBeTrue();
    });


    it("rejects unknown top-level keys", async () => {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "app-config-test-"));
        const repoRoot = new Directory(tempRoot);

        const repoFile = new File(repoRoot, "configs/git/.gitconfig");
        await repoFile.write("x");

        const envVarName = "APP_CONFIG_TEST_DEPLOYED";
        process.env[envVarName] = path.join(tempRoot, "deployed");
        const placeholder = "$" + "{" + envVarName + "}";

        const configFile = new File(repoRoot, "review.jsonc");
        await configFile.write(
            [
                "{",
                "  \"mappings\": [",
                "    {",
                "      \"repoRelativePath\": \"configs/git/.gitconfig\",",
                "      \"deployedAbsolutePath\": \"" + placeholder + "/.gitconfig\"",
                "    }",
                "  ],",
                "  \"extra\": true",
                "}"
            ].join("\n")
        );

        const result = await parseReviewConfig(configFile, repoRoot);

        expect(result.failed).toBeTrue();
    });


    it("fails when repo file does not exist", async () => {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "app-config-test-"));
        const repoRoot = new Directory(tempRoot);

        const envVarName = "APP_CONFIG_TEST_DEPLOYED";
        process.env[envVarName] = path.join(tempRoot, "deployed");
        const placeholder = "$" + "{" + envVarName + "}";

        const configFile = new File(repoRoot, "review.jsonc");
        await configFile.write(
            [
                "{",
                "  \"mappings\": [",
                "    {",
                "      \"repoRelativePath\": \"configs/git/.gitconfig\",",
                "      \"deployedAbsolutePath\": \"" + placeholder + "/.gitconfig\"",
                "    }",
                "  ]",
                "}"
            ].join("\n")
        );

        const result = await parseReviewConfig(configFile, repoRoot);

        expect(result.failed).toBeTrue();
    });


    it("rejects repoRelativePath traversal", async () => {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "app-config-test-"));
        const repoRoot = new Directory(tempRoot);

        const envVarName = "APP_CONFIG_TEST_DEPLOYED";
        process.env[envVarName] = path.join(tempRoot, "deployed");
        const placeholder = "$" + "{" + envVarName + "}";

        const configFile = new File(repoRoot, "review.jsonc");
        await configFile.write(
            [
                "{",
                "  \"mappings\": [",
                "    {",
                "      \"repoRelativePath\": \"../outside.txt\",",
                "      \"deployedAbsolutePath\": \"" + placeholder + "/outside.txt\"",
                "    }",
                "  ]",
                "}"
            ].join("\n")
        );

        const result = await parseReviewConfig(configFile, repoRoot);

        expect(result.failed).toBeTrue();
    });
});
