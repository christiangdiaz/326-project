import js from "@eslint/js";
import globals from "globals";

// Flat config. Lint is here to catch the class of mistake that reads fine and
// fails at runtime — an unused import left behind by a refactor, a variable
// used before it is defined, a promise nobody awaited — not to argue about
// formatting, which is why no style rules are switched on.

export default [
  {
    ignores: [
      "node_modules/**",
      "public/style.css",
      "public/vendor/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          // Express identifies an error handler by its four-argument
          // signature, so the trailing `next` has to stay even unused.
          args: "after-used",
          argsIgnorePattern: "^_|^next$",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error"
    }
  },
  {
    // Browser code: no Node globals, and the htmx bundle is loaded separately.
    files: ["public/app.js"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },
  {
    files: ["__tests__/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    }
  }
];
