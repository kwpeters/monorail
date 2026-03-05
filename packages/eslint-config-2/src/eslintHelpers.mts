/* eslint-disable @typescript-eslint/naming-convention */

import type { ConfigWithExtends, ConfigWithExtendsArray } from "@eslint/config-helpers";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import turboConfig from "eslint-config-turbo/flat";
import globals from "globals";


/**
 * Helper function that gets glob patterns of common files that ESLint should
 * ignore.
 */
export function getIgnorePatterns(): string[] {
    return [
        // Built files
        "**/build/**",
        "**/dist/**",
        "**/.turbo/*",
        // Don't lint eslint config files because they are not included in in the TS project.
        "**/eslint.config.ts"
    ];
}


/**
 * Gets JS/TS base configurations and customizations.
 *
 * @param browserGlobals - Whether to include browser globals
 * @param nodeGlobals - Whether to include Node.js globals
 * @return The JS/TS base configurations and customizations
 */
export function getJsConfig(browserGlobals: boolean, nodeGlobals: boolean): ConfigWithExtendsArray {

    const globalsConfig = {
        ...(browserGlobals ? globals.browser : {}),
        ...(nodeGlobals ? globals.node : {})
    };

    return [
        {
            files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
            plugins: {
                js,
                "@stylistic": stylistic
            },
            extends: ["js/recommended"],
            languageOptions: {
                globals: globalsConfig
            },
            rules: {
                "@stylistic/indent": [
                    "error",
                    4,
                    {
                        "ignoredNodes": [
                            "ConditionalExpression"
                        ],
                        "MemberExpression": 0, // Chaining methods does not require indentation
                        "SwitchCase": 1,
                        "flatTernaryExpressions": true,
                        "ignoreComments": true,
                        "FunctionDeclaration": {
                            "parameters": "first"
                        },
                        "FunctionExpression": {
                            "parameters": "first"
                        },
                        "CallExpression": {
                            "arguments": "first"
                        },
                        "ArrayExpression": "first",
                        "ObjectExpression": "first",
                        "ImportDeclaration": "first"
                    }
                ],
                "@stylistic/object-property-newline": [
                    "error",
                    {
                        "allowAllPropertiesOnSameLine": true
                    }
                ],
                "max-len": [
                    "error",
                    {
                        "code": 120,
                        "tabWidth": 4,
                        "comments": 160,
                        "ignoreComments": true,
                        "ignoreUrls": true,
                        "ignoreStrings": true,
                        "ignoreTemplateLiterals": true,
                        "ignoreRegExpLiterals": true
                    }
                ],
                "prefer-named-capture-group": ["error"],
            }
        }
    ]
}


/**
 * Gets TS base configuration and customizations.
 *
 * @param projDir - The project directory (typically `import.meta.dirname`)
 * @return The TypeScript-specific configurations and customizations
 */
export function getTsConfig(projDir: string): ConfigWithExtendsArray {
    return [
        // Scope all typescript-eslint rules to TypeScript files only. This
        // prevents TS rules (both type-aware and non-type-aware) from running
        // on .md, .css, .json, etc.
        {
            files: ["**/*.{ts,mts,cts}"],
            extends: [
                ...tseslint.configs.strictTypeChecked,
                ...tseslint.configs.stylisticTypeChecked,
            ],
            languageOptions: {
                parserOptions: {
                    // Enables TypeScript's language service to automatically find
                    // the nearest tsconfig.json for each file, giving type-aware
                    // lint rules (e.g. @typescript-eslint/no-floating-promises)
                    // access to full type information.
                    projectService: true,
                    // Anchors the tsconfig.json search to this directory, mirroring
                    // how the TypeScript compiler resolves config files.
                    tsconfigRootDir: projDir,
                },
            },
            rules: {
                "@typescript-eslint/array-type": ["off"],
                "@typescript-eslint/member-ordering": [
                    "error",
                    {
                        "default": [
                            // Static
                            "public-static-field",
                            "protected-static-field",
                            "private-static-field",
                            "#private-static-field",
                            "static-field",
                            "public-static-accessor",
                            "protected-static-accessor",
                            "private-static-accessor",
                            "#private-static-accessor",
                            "static-initialization",
                            "public-static-method",
                            "protected-static-method",
                            "private-static-method",
                            "#private-static-method",
                            "static-method",

                            "private-decorated-field",
                            "private-instance-field",
                            "#private-instance-field",
                            "private-field",
                            "#private-field",
                            "protected-decorated-field",
                            "protected-instance-field",
                            "protected-abstract-field",
                            "protected-field",

                            // Constructors
                            "public-constructor",
                            "protected-constructor",
                            "private-constructor",
                            "constructor",

                            // Fields
                            "instance-field",
                            "abstract-field",
                            "decorated-field",
                            "field",

                            "public-decorated-field",
                            "public-instance-field",
                            "public-abstract-field",
                            "public-field",

                            // Index signature
                            "signature",
                            "call-signature",

                            // Accessors
                            "public-accessor",
                            "protected-accessor",
                            "private-accessor",
                            "#private-accessor",

                            // Methods
                            "public-decorated-method",
                            "protected-decorated-method",
                            "private-decorated-method",
                            "public-instance-method",
                            "protected-instance-method",
                            "private-instance-method",
                            "#private-instance-method",
                            "public-abstract-method",
                            "protected-abstract-method",
                            "public-method",
                            "protected-method",
                            "private-method",
                            "#private-method",
                            "instance-method",
                            "abstract-method",
                            "decorated-method",
                            "method"
                        ]
                    }
                ],
                "@typescript-eslint/naming-convention": [
                    "error",
                    {
                        "selector": "default",
                        "leadingUnderscore": "allow",
                        "trailingUnderscore": "allow",
                        "format": [
                            "camelCase"
                        ]
                    },
                    {
                        "selector": "variable",
                        "modifiers": [
                            "const",
                            "global"
                        ],
                        "leadingUnderscore": "allowSingleOrDouble",
                        "trailingUnderscore": "allow",
                        "format": [
                            "camelCase",
                            "UPPER_CASE"
                        ]
                    },
                    {
                        "selector": "variable",
                        "leadingUnderscore": "allowSingleOrDouble",
                        "trailingUnderscore": "allow",
                        "format": [
                            "camelCase"
                        ]
                    },
                    {
                        "selector": "typeLike",
                        "format": [
                            "PascalCase"
                        ]
                    },
                    {
                        "selector": "enumMember",
                        // Allow leading underscores for situations where the member
                        // would otherwise start with a numeric digit.
                        "leadingUnderscore": "allow",
                        "format": [
                            "PascalCase",
                            "UPPER_CASE"
                        ]
                    },
                    {
                        "selector": "objectLiteralProperty",
                        "leadingUnderscore": "allow",
                        "trailingUnderscore": "allow",
                        "format": [
                            "camelCase",
                            "UPPER_CASE"
                        ]
                    },
                    {
                        // Angular module variables (ending in "Module") should be PascalCase
                        "selector": [
                            "variable"
                        ],
                        "filter": {
                            "regex": "^.*Module$",
                            "match": true
                        },
                        "format": [
                            "PascalCase"
                        ]
                    },
                    {
                        "selector": "interface",
                        // No longer requiring the "I" prefix, because a type is a type.
                        // "prefix": [
                        //     "I"
                        // ],
                        "format": [
                            "PascalCase"
                        ]
                    },
                    {
                        "selector": "typeParameter",
                        "prefix": [
                            "T"
                        ],
                        "format": [
                            "PascalCase"
                        ]
                    },
                    {
                        "selector": [
                            "classProperty"
                        ],
                        "modifiers": [
                            "static",
                            "readonly"
                        ],
                        "format": [
                            "UPPER_CASE"
                        ]
                    },
                    {
                        "selector": [
                            "classProperty"
                        ],
                        "modifiers": [
                            "private"
                        ],
                        "leadingUnderscore": "require",
                        "format": [
                            "camelCase"
                        ]
                    }
                ],
                "@typescript-eslint/no-confusing-void-expression": ["off", { ignoreArrowShorthand: true }],
                "@typescript-eslint/no-inferrable-types": ["off"],
                "@typescript-eslint/no-non-null-assertion": ["off"],
                "@typescript-eslint/no-unnecessary-condition": [
                    "error",
                    {
                        allowConstantLoopConditions: true, // It's common to have while(true) loops that break internally
                    }
                ],
                "@typescript-eslint/no-unused-vars": [
                    "error",
                    {
                        "vars": "all",
                        "varsIgnorePattern": "^[_]{2,}\\w*$", // Unused variables should start with __
                        "args": "none", // It's ok to have unused args b/c they provide signature documentation
                        "caughtErrors": "none"
                    }
                ],
                "@typescript-eslint/restrict-template-expressions": ["error", {allowNumber: true}],
                "@typescript-eslint/unbound-method": [
                    "error",
                    {
                        "ignoreStatic": true
                    }
                ],
                "@typescript-eslint/unified-signatures": ["off"],
            }
        },
    ];
}


/**
 * Gets Turbo linting configuration and customizations.
 */
export function getTurboConfig(): ConfigWithExtendsArray {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return turboConfig;
}


/**
 * Get JSON linting configuration and customizations.
 */
export function getJsonConfig(): ConfigWithExtends {
    return { files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] }
}


/**
 * Get JSONC linting configuration and customizations.
 */
export function getJsoncConfig(): ConfigWithExtends {
    return { files: ["**/*.jsonc"], plugins: { json }, language: "json/jsonc", extends: ["json/recommended"] };
}


/**
 * Get JSON5 linting configuration and customizations.
 */
export function getJson5Config(): ConfigWithExtends {
    return { files: ["**/*.json5"], plugins: { json }, language: "json/json5", extends: ["json/recommended"] };
}


/**
 * Get Markdown linting configuration and customizations.
 */
export function getMarkdownConfig(): ConfigWithExtends {
    // Fix: The following cast is needed because the Markdown plugin has not been updated
    // to eslint 10 types yet.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const markdownPlugin = markdown as unknown as Plugin;
    return { files: ["**/*.md"], plugins: { markdown: markdownPlugin }, language: "markdown/gfm", extends: ["markdown/recommended"] };
}


/**
 * Get CSS linting configuration and customizations.
 */
export function getCssConfig(): ConfigWithExtends {
    // Fix: The following cast is needed because the CSS plugin has not been updated
    // to eslint 10 types yet.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const cssPlugin = css as unknown as Plugin;
    return { files: ["**/*.css"], plugins: { css: cssPlugin }, language: "css/css", extends: ["css/recommended"] };
}
