# material-color-utilities

A part of Google's [material-color-utilities](https://github.com/material-foundation/material-color-utilities), the TypeScript edition as published on npm: `@material/material-color-utilities` **0.4.0**, under the Apache License 2.0 (see `LICENSE`).

Ledge uses it to derive a colour scheme from the wallpaper (`lib/scheme.js`). The five styles that ship with Ledge were derived with the Dart edition of the same library; `tests/scheme.test.js` checks that this copy gives the same colours.

## What Was Changed

- **Only what is needed:** the 25 modules that the vibrant scheme, the dynamic colours, the Celebi quantizer and the score import, found by following their imports. The modules for the browser (`utils/image_utils.js`, `utils/theme_utils.js`), the other schemes, the tests and the source maps are left out.
- **File extensions on imports:** a few imports named a module without `.js`, which GJS does not resolve; the extension was added.
- **Source map comments removed**, since the maps are not included.

Nothing else was touched. To update, unpack the npm package and copy the same modules again with those two changes.
