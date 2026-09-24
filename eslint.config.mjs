// The linter exists for one rule, and everything else here is about keeping
// that rule readable.
//
// On 24 September the League tab threw "reveal is not defined" in production:
// a hook declared in one component and used in the next one down. The build
// compiled it without a word, because an undefined identifier is not a syntax
// error, and it only threw once that panel rendered. Nothing in the project
// could have caught it. no-undef catches exactly that, and it is off by
// default in most setups because TypeScript usually covers it. This project is
// plain JavaScript, so it is turned on by hand, and the globals have to be
// declared or every `window` in the codebase becomes an error.
//
// The rest is triage. eslint-config-next brings React's new compiler rules,
// which found 53 errors here. They describe real constraints, but this app
// does not run the compiler, and a lint script that is permanently red is a
// lint script nobody runs, which would cost exactly the bug this file was
// added to prevent. So the rules that catch broken code are errors, and the
// rules that describe a stricter style than this codebase is written in are
// warnings: still printed, still countable, not in the way.

import next from 'eslint-config-next';
import globals from 'globals';
// Named explicitly because flat config resolves a plugin per config object:
// rules below live in their own object, so the plugin that owns them has to
// be declared there too, not just inside eslint-config-next.
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'brand/**', 'public/**', 'app/dev-preview/**'] },

  ...next,

  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    plugins: { 'react-hooks': reactHooks, react },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // The whole reason this file exists.
      'no-undef': 'error',
      // Calling a hook conditionally or inside a callback genuinely breaks
      // React, so this one stays an error.
      'react-hooks/rules-of-hooks': 'error',

      // Its near neighbour: a name assigned and never read is usually the
      // other half of a rename that only got done in one place, which is how
      // the hook ended up in the wrong component.
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],

      // React's compiler rules. Worth reading, not worth blocking on, because
      // nothing here compiles under them.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/use-memo': 'warn',

      // An apostrophe in prose is an apostrophe.
      'react/no-unescaped-entities': 'off',
    },
  },

  // Build scripts are CommonJS and run in Node only.
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
];

export default config;
