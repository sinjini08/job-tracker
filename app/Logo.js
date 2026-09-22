

// The tracker's mark, from brand/source-logo.png. Every icon file is generated
// by scripts/build-logo.cjs, so replacing that one source image (and re-running
// the script) updates the app bar, sign-in page, tab icon and exports together.
//
// `tone`:
//   'light' — the white mark, for green or dark backgrounds
//   'dark'  — the green mark, for white or paper backgrounds
// `badge`  — the full rounded-square icon instead of the bare mark.

// The product's name, in one place. The landing hero, the app bar and the
// browser tab all read it from here, so renaming the thing is a one-line change.
export const PRODUCT_NAME = 'Job Application Tracker';

export const BRAND = {
  green: '#1d5c36',
  greenDeep: '#14472a',
  greenMid: '#2e7d46',
  greenLight: '#69b57f',
  paper: '#f5f5f0',
  sand: '#e8e8dc',
};

// Bumped by scripts/build-logo.cjs whenever the artwork changes, so browsers
// and CDNs can't serve a stale mark.
const V = '67ffaf7a';

export default function Logo({ size = 28, tone = 'light', badge = false, title = PRODUCT_NAME }) {
  const file = badge ? 'icon-green' : tone === 'dark' ? 'mark-green' : 'mark-white';
  return (
    // A plain <img>: these are small PNGs, and skipping the image optimizer
    // keeps the mark pixel-exact at every size.
    <img
      src={`/brand/${file}.png?v=${V}`}
      alt={title}
      width={size}
      height={size}
      style={{
        display: 'block',
        width: size,
        height: size,
        objectFit: 'contain',
        borderRadius: badge ? size * 0.22 : 0,
      }}
    />
  );
}
