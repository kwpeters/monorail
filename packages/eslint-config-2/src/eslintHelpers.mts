/* eslint-disable @stylistic/key-spacing */
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
                "@stylistic/brace-style": [
                    "error",
                    "stroustrup",
                    {
                        "allowSingleLine": true
                    }
                ],
                "@stylistic/comma-dangle": [
                    "error",
                    "only-multiline"
                ],
                "@stylistic/comma-spacing": "error",
                "@stylistic/function-call-spacing": ["error"],
                "@stylistic/key-spacing": [
                    "error",
                    {
                        "beforeColon": false,
                        "afterColon": true,
                        "mode": "minimum",
                        "align": {
                            "beforeColon": false,
                            "afterColon": true,
                            "on": "value",
                            "mode": "strict"
                        }
                    }
                ],
                "@stylistic/keyword-spacing": [
                    "error",
                    {
                        "before": true,
                        "after": true
                    }
                ],
                "@stylistic/lines-between-class-members": [
                    "error",
                    "always",
                    {
                        "exceptAfterSingleLine": true,
                        "exceptAfterOverload": true
                    }
                ],
                "@stylistic/quotes": [
                    "error",
                    "double",
                    {
                        "avoidEscape": true,
                        "allowTemplateLiterals": "always"
                    }
                ],
                "@stylistic/semi": [
                    "error",
                    "always"
                ],
                "@stylistic/space-before-function-paren": [
                    "error",
                    {
                        "anonymous": "always",
                        "named": "never",
                        "asyncArrow": "always"
                    }
                ],
                "@stylistic/type-annotation-spacing": ["error"],
                "accessor-pairs": "off",
                "array-bracket-newline": [
                    "error",
                    "consistent"
                ],
                "array-bracket-spacing": [
                    "error",
                    "never"
                ],
                "array-callback-return": "off",
                "arrow-body-style": "off",
                "arrow-parens": [
                    "error",
                    "always"
                ],
                "arrow-spacing": [
                    "error",
                    {
                        "before": true,
                        "after": true
                    }
                ],
                "block-scoped-var": "error",
                "block-spacing": "error",
                "camelcase": "off",
                "comma-style": [
                    "error",
                    "last"
                ],
                "computed-property-spacing": [
                    "error",
                    "never"
                ],
                "consistent-this": [
                    "error",
                    "self"
                ],
                "curly": "error",
                "default-case-last": "error",
                "default-param-last": "off",
                "dot-location": [
                    "error",
                    "property"
                ],
                "dot-notation": "off",
                "eol-last": "error",
                "eqeqeq": [
                    "error",
                    "always"
                ],
                "func-name-matching": [
                    "error",
                    "always",
                    {
                        "considerPropertyDescriptor": true,
                        "includeCommonJSModuleExports": true
                    }
                ],
                "func-names": "off",
                "function-paren-newline": [
                    "error",
                    "consistent"
                ],
                "grouped-accessor-pairs": [
                    "error",
                    "getBeforeSet"
                ],
                "guard-for-in": "error",
                "implicit-arrow-linebreak": [
                    "error",
                    "beside"
                ],
                "linebreak-style": "off",
                "indent": ["off"],
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
                "new-parens": "error",
                "no-constructor-return": "error",
                "no-duplicate-imports": "error",
                "no-eq-null": "error",
                "no-eval": [
                    "error",
                    {
                        "allowIndirect": true
                    }
                ],
                "no-extend-native": "error",
                "no-extra-bind": "error",
                "no-implicit-coercion": [
                    "error",
                    {
                        "boolean": false,
                        "number": true,
                        "string": true
                    }
                ],
                "no-implied-eval": "error",
                "no-lone-blocks": "error",
                "no-loop-func": "off",
                "no-new-func": "error",
                "no-new-wrappers": "error",
                "no-promise-executor-return": "error",
                "no-return-await": "error",
                "no-self-compare": "error",
                "no-sequences": "error",
                "no-template-curly-in-string": "error",
                "no-trailing-spaces": "error",
                "no-underscore-dangle": ["off"],
                "no-unmodified-loop-condition": "error",
                "no-unneeded-ternary": "error",
                "no-unreachable-loop": "error",
                "no-unsafe-optional-chaining": [
                    "error",
                    {
                        "disallowArithmeticOperators": true
                    }
                ],
                "no-unused-expressions": "off",
                "no-unused-vars": "off",
                "no-useless-backreference": "error",
                "no-useless-call": "error",
                "no-useless-computed-key": [
                    "error",
                    {
                        "enforceForClassMembers": true
                    }
                ],
                "no-useless-rename": "error",
                "no-var": "error",
                "no-void": "off",
                "no-whitespace-before-property": "error",
                "object-curly-newline": [
                    "error",
                    {
                        "consistent": true
                    }
                ],
                "object-property-newline": [
                    "error",
                    {
                        "allowAllPropertiesOnSameLine": true
                    }
                ],
                "object-shorthand": ["off"],
                "one-var": [
                    "error",
                    {
                        "var": "never",
                        "let": "never",
                        "const": "never",
                        "separateRequires": true
                    }
                ],
                "one-var-declaration-per-line": [
                    "error",
                    "always"
                ],
                "prefer-arrow/prefer-arrow-functions": "off",
                "prefer-const": [
                    "error",
                    {
                        "destructuring": "all"
                    }
                ],
                "prefer-named-capture-group": ["error"],
                "prefer-object-spread": "error",
                "prefer-rest-params": "error",
                "prefer-spread": "error",
                "radix": [
                    "error",
                    "always"
                ],
                "require-atomic-updates": ["error"],
                "require-await": "off",
                "rest-spread-spacing": "error",
                "semi-spacing": [
                    "error",
                    {
                        "before": false,
                        "after": true
                    }
                ],
                "semi-style": [
                    "error",
                    "last"
                ],
                "space-before-blocks": [
                    "error",
                    "always"
                ],
                "space-in-parens": ["off"],
                "space-infix-ops": ["error"],
                "space-unary-ops": [
                    "error",
                    {
                        "words": true,
                        "nonwords": false
                    }
                ],
                "spaced-comment": [
                    "error",
                    "always",
                    {
                        "exceptions": [
                            "-",
                            "+",
                            "=",
                            "/",
                            "*"
                        ],
                        "markers": [
                            "/"
                        ]
                    }
                ],
                "switch-colon-spacing": "error",
                "wrap-iife": [
                    "error",
                    "any"
                ],
            }
        }
    ];
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
                // Disable core rule before configuring @typescript-eslint extension rule (Appendix B requirement)
                "default-param-last": "off",
                "@typescript-eslint/default-param-last": ["error"],
                "@typescript-eslint/explicit-module-boundary-types": ["error"],
                "@typescript-eslint/no-confusing-void-expression": ["off", { ignoreArrowShorthand: true }],
                "@typescript-eslint/no-empty-object-type": "error",
                "@typescript-eslint/no-explicit-any": "warn",
                // Disable core rule before configuring @typescript-eslint extension rule (Appendix B requirement)
                "no-loop-func": "off",
                "@typescript-eslint/no-loop-func": ["error"],
                "@typescript-eslint/no-namespace": "off",
                // Disable core rule before configuring @typescript-eslint extension rule (Appendix B requirement)
                "no-inferrable-types": "off",
                "@typescript-eslint/no-inferrable-types": ["off"],
                "@typescript-eslint/no-non-null-assertion": ["off"],
                "@typescript-eslint/no-unnecessary-boolean-literal-compare": ["error"],
                "@typescript-eslint/no-unnecessary-condition": [
                    "error",
                    {
                        allowConstantLoopConditions: true, // It's common to have while(true) loops that break internally
                    }
                ],
                "@typescript-eslint/no-unsafe-function-type": "error",
                // Disable core rule before configuring @typescript-eslint extension rule (Appendix B requirement)
                "no-unused-expressions": "off",
                "@typescript-eslint/no-unused-expressions": "error",
                // Disable core rule before configuring @typescript-eslint extension rule (Appendix B requirement)
                "no-unused-vars": "off",
                "@typescript-eslint/no-unused-vars": [
                    "error",
                    {
                        "vars": "all",
                        "varsIgnorePattern": "^[_]{2,}\\w*$", // Unused variables should start with __
                        "args": "none", // It's ok to have unused args b/c they provide signature documentation
                        "caughtErrors": "none"
                    }
                ],
                "@typescript-eslint/no-wrapper-object-types": "error",
                "@typescript-eslint/prefer-for-of": ["error"],
                "@typescript-eslint/prefer-function-type": ["error"],
                "@typescript-eslint/prefer-includes": ["error"],
                "@typescript-eslint/prefer-literal-enum-member": [
                    "error",
                    {
                        "allowBitwiseExpressions": true
                    }
                ],
                "@typescript-eslint/prefer-optional-chain": ["error"],
                "@typescript-eslint/prefer-readonly": ["error"],
                "@typescript-eslint/prefer-reduce-type-parameter": ["off"],
                "@typescript-eslint/prefer-return-this-type": ["error"],
                "@typescript-eslint/prefer-string-starts-ends-with": ["error"],
                "@typescript-eslint/prefer-ts-expect-error": ["error"],
                // Disable core rule before configuring @typescript-eslint extension rule (Appendix B requirement)
                "require-await": "off",
                "@typescript-eslint/require-await": "error",
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
        // Test file overrides
        {
            files: [
                "**/*.{test,spec}.{ts,mts,cts}",
                "**/*.{test,spec}.{js,mjs,cjs}"
            ],
            rules: {
                "@typescript-eslint/no-empty-function": "off",
                "@typescript-eslint/no-unused-vars": "off",
                "@typescript-eslint/no-floating-promises": "off",
                // Disable core rule before configuring @typescript-eslint extension rule (Appendix B requirement)
                "dot-notation": "off",
                "@typescript-eslint/dot-notation": [
                    "error",
                    {
                        // Allow unit tests to make assertions about private and protected fields.
                        "allowPrivateClassPropertyAccess": true,
                        "allowProtectedClassPropertyAccess": true
                    }
                ],
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
    return { files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] };
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
