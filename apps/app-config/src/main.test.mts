import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { buildCli, main } from "./main.mjs";


describe("main CLI", () => {

    it("supports review --help", () => {
        expect(() => {
            buildCli(["review", "--help"]).exitProcess(false).parse();
        }).not.toThrow();
    });


    it("fails when configFile argument is missing", () => {
        expect(() => {
            buildCli(["review"]).exitProcess(false).parse();
        }).toThrow();
    });


    it("runs review command with a valid config file", async () => {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "app-config-main-test-"));

        const repoFilePath = path.join(tempRoot, "configs", "git", ".gitconfig");
        await fs.mkdir(path.dirname(repoFilePath), { recursive: true });
        await fs.writeFile(repoFilePath, "[user]\nname=test\n", "utf8");

        const deployRoot = path.join(tempRoot, "deployed");
        await fs.mkdir(deployRoot, { recursive: true });
        await fs.writeFile(path.join(deployRoot, ".gitconfig"), "[user]\nname=test\n", "utf8");

        const envVarName = "APP_CONFIG_MAIN_DEPLOY";
        process.env[envVarName] = deployRoot;
        const placeholder = "$" + "{" + envVarName + "}";

        const configPath = path.join(tempRoot, "review.jsonc");
        await fs.writeFile(
            configPath,
            [
                "{",
                "  \"mappings\": [",
                "    {",
                "      \"repoRelativePath\": \"configs/git/.gitconfig\",",
                "      \"deployedAbsolutePath\": \"" + placeholder + "/.gitconfig\"",
                "    }",
                "  ]",
                "}"
            ].join("\n"),
            "utf8"
        );

        const previousCwd = process.cwd();
        process.chdir(tempRoot);
        try {
            const result = await main(["review", configPath]);
            expect(result).toBe(0);
        }
        finally {
            process.chdir(previousCwd);
        }
    });
});
