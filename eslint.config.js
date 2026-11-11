// Strict config (1.6.0): correctness rules are errors everywhere; complexity/size budgets keep modules small.
// Layering is enforced for domain/data/core (ui → services → domain → data → core). Formatting is Prettier's job.
import globals from "globals";
const strict = {
  "no-undef": "error",
  "no-redeclare": "error",
  "no-dupe-keys": "error",
  "no-unreachable": "error",
  "no-unused-vars": [
    "error",
    { args: "after-used", argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }
  ],
  eqeqeq: ["error", "always", { null: "ignore" }],
  "no-var": "error",
  "prefer-const": ["error", { destructuring: "all" }],
  complexity: ["error", 15],
  "max-lines": ["error", { max: 600, skipBlankLines: true, skipComments: true }],
  "max-depth": ["error", 4],
  "no-eval": "off",
  "no-implied-eval": "error",
  "no-new-func": "off",
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-prototype-builtins": "error",
  "no-self-compare": "error",
  "no-template-curly-in-string": "error"
};
export default [
  {
    ignores: [
      "node_modules/**",
      "assets/vendor/**",
      "supabase/functions/**",
      "playwright-report/**",
      "test-results/**",
      "clients/**"
    ]
  },
  {
    files: ["assets/js/**/*.js", "scripts/**/*.mjs", "tests/**/*.mjs", "e2e/**/*.mjs", "*.config.js", "*.config.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, DOMPurify: "readonly" }
    },
    rules: strict
  },
  // Legacy services/ui functions above the complexity budget are WARNINGS, frozen by scripts/check-complexity.mjs
  // (count may only go down — see .complexity-baseline.json). New code and domain/data/core/scripts/tests are strict.
  { files: ["assets/js/services/**/*.js", "assets/js/ui/**/*.js"], rules: { complexity: ["warn", 15] } },
  {
    files: ["assets/js/domain/**/*.js", "assets/js/data/**/*.js", "assets/js/core/**/*.js"],
    rules: {
      "no-restricted-globals": ["error", "document", "window", "localStorage"],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/ui/**", "**/services/**"],
              message: "domain/data/core must not import ui or services (ui → services → domain → data → core)."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["sw.js"],
    languageOptions: { globals: globals.serviceworker },
    rules: { "no-undef": "error", "no-var": "error", eqeqeq: "error" }
  }
];
