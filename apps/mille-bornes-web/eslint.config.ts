import { defineConfig, globalIgnores } from "eslint/config";
import { getJsConfig, getJsonConfig, getJsoncConfig, getJson5Config,
         getMarkdownConfig, getCssConfig,
         getTsConfig,
         getReactConfig,
         getIgnorePatterns,
         getTurboConfig} from "@repo/eslint-config/eslintHelpers";


export default defineConfig([
    // Glob patterns that specify files ESLint should ignore
    globalIgnores(getIgnorePatterns()),
    // What the end-to-end tests leave behind
    globalIgnores(["test-results/**", "playwright-report/**"]),
    // JS global definitions, ESLint rule configuration and @stylistic rule configurations
    getJsConfig(true, false),
    // TS type checking configuration and @typescript-eslint rule configurations
    ...getTsConfig(import.meta.dirname),
    // React hooks rule configuration for .tsx/.jsx files
    ...getReactConfig(),
    // Turbo recommended rule configuration
    ...getTurboConfig(),
    // JSON linting configuration
    getJsonConfig(),
    // JSONC linting configuration
    getJsoncConfig(),
    // JSON5 linting configuration
    getJson5Config(),
    // Markdown linting configuration
    getMarkdownConfig(),
    // CSS linting configuration
    getCssConfig()
]);
