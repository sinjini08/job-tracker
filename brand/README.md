# Brand

The mark is a bullseye with a dart: aiming at a role, and hitting it.

| File | Use |
|---|---|
| `icon-green.svg` / `-512.png` / `-1024.png` | app icon, profile pictures, anywhere on a light background |
| `icon-white.svg` / `-512.png` / `-1024.png` | the same mark on white, for slides and print |
| `mark-transparent.svg` / `-512.png` / `-1024.png` | mark only, no background square |

## Palette

| Token | Hex | Used for |
|---|---|---|
| paper | `#f5f5f0` | page background, header rows |
| sand | `#e8e8dc` | gridlines, borders |
| green | `#2e6b3d` | app bar, buttons, the logo |
| green-mid | `#4a8b5a` | hovers, the dart on white |
| green-light | `#6bb87a` | the dart on green, lightest funnel step |

Charts use `#1f9d55` (On-Campus) and `#e0651f` (Off-Campus): a pair checked for
colourblind separation against the `#f5f5f0` surface. The funnel ramp is
`#6bb87a → #4a8b5a → #2e6b3d → #215030 → #143520`.
The live version is `app/Logo.js`; `app/icon.svg` is the browser tab icon and
`app/apple-icon.png` the phone home-screen icon. Change `app/Logo.js` and re-run
`scripts/export-logo.mjs` to regenerate these files.
