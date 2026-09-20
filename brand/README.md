# Brand

The mark is a bullseye with a dart: aiming at a role, and hitting it.
`source-logo.png` is the original artwork; every other file is generated from it
by `node scripts/build-logo.cjs`. Replace that file and re-run the script to
change the logo everywhere.

| File | Use |
|---|---|
| `source-logo.png` | the original artwork — the one file to replace |
| `icon-green-512.png` / `-1024.png` | app icon, profile pictures, LinkedIn |
| `mark-green-512.png` / `-1024.png` | mark only, transparent, for light backgrounds |
| `public/brand/mark-white.png` | mark only, white, used in the app's green bar |
| `app/icon.png`, `app/apple-icon.png` | browser tab and phone home screen |

## Palette — "Forest"

| Token | Hex | Used for |
|---|---|---|
| paper | `#f5f5f0` | page background, header rows |
| sand | `#e8e8dc` | gridlines, borders |
| green | `#1d5c36` | app bar, buttons, the logo (sampled from the artwork) |
| green-mid | `#2e7d46` | hovers |
| green-light | `#69b57f` | lightest funnel step |

Charts, all checked with the dataviz validator against `#f5f5f0`:

- Series, in fixed order: `#1f9d55` · `#2a78d6` · `#e0651f` · `#8a5bd0` · `#d1478c`.
  Slots 1 and 2 are On-Campus and Off-Campus; the rest appear in the by-source
  and by-category charts.
- Funnel ramp: `#69b57f → #4a9463 → #2e7d46 → #1d5c36 → #123c22`.

Colours live in `app/globals.css` (`:root`). Changing them there updates the app;
re-run `node scripts/build-logo.cjs` afterwards so the logo files follow.
