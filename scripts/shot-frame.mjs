// Build the store screenshot pages.
//
// The popup cannot be put in an iframe: the app sends X-Frame-Options: deny,
// which is right for the app and fatal here. So the popup's own markup, CSS
// and script are inlined into the page instead, copied at build time from
// extension/ rather than retyped, so what ends up in the store listing is the
// real popup rather than a drawing of one.
//
// Output is public/_shot/, which is gitignored: these are throwaway pages for
// producing three images.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const ext = join(here, '..', 'extension');
const out = join(here, '..', 'public', '_shot');
mkdirSync(out, { recursive: true });

for (const f of ['popup.js', 'extract.js', 'iso-date.js']) copyFileSync(join(ext, f), join(out, f));
copyFileSync(join(here, 'fixtures', 'linkedin.html'), join(out, 'linkedin.html'));

const popupHtml = readFileSync(join(ext, 'popup.html'), 'utf8');
const popupCss = readFileSync(join(ext, 'popup.css'), 'utf8');

// Everything inside <body>, minus the script tag, which is loaded separately
// after the stub.
const body = popupHtml.match(/<body>([\s\S]*?)<\/body>/i)[1]
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .trim();

// The popup styles itself through `body`. Rehomed onto a wrapper so they
// apply to a box on the page instead of to the page.
const css = popupCss.replace(/(^|\})\s*body\s*\{/g, '$1\n.popup {');

const SHOTS = [
  {
    n: 1,
    head: 'Save a posting without retyping it',
    sub: 'Open a job, click the icon. It reads what the page says, and shows you before anything is saved.',
    pts: ['Role, employer, pay, location, deadline', 'Marked CHECK when it was worked out, not read', 'Wishlist now, applied in one click later'],
    state: 'form',
  },
  {
    n: 2,
    head: 'It knows what you already saved',
    sub: 'Open a job you saved last week and it tells you, with where it stands, instead of quietly adding it twice.',
    pts: ['No duplicate rows', 'Mark it applied the moment you send it', 'Your tracker stays true without the admin'],
    state: 'known',
  },
];

for (const shot of SHOTS) {
  writeFileSync(join(out, `shot${shot.n}.html`), `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Store screenshot ${shot.n}</title>
<style>
/* ---- the canvas the store wants, exactly ---- */
html, body { margin: 0; padding: 0; background: #14110f; }
.shot {
  width: 1280px; height: 800px; box-sizing: border-box;
  display: flex; align-items: center; gap: 80px; padding: 0 90px;
  background: radial-gradient(120% 90% at 18% 28%, #2c7a4b, #1d5c36 55%, #14472a 100%);
  font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #fff; overflow: hidden;
}
.say { width: 460px; flex: none; }
.say h1 { margin: 0 0 18px; font-size: 44px; line-height: 1.08; letter-spacing: -0.02em; font-weight: 700; }
.say > p { margin: 0; font-size: 19px; line-height: 1.55; color: rgba(255,255,255,0.82); }
.say ul { margin: 24px 0 0; padding: 0; list-style: none; }
.say li { display: flex; gap: 10px; margin-bottom: 11px; font-size: 17px; color: rgba(255,255,255,0.92); }
.say li b { color: #a7e8c0; font-weight: 700; }
/* The popup is as tall as its content, which on a well-filled posting is
   taller than the canvas. Scaled to fit rather than clipped, because the
   clipped part is the save button and the pickers, which are the point. The
   scale is measured after render rather than guessed, so a shot of a shorter
   state is left at full size. */
.lift {
  flex: none; border-radius: 14px; background: #fff;
  box-shadow: 0 30px 60px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.22);
  transform-origin: center center;
}

/* ---- the popup's own stylesheet, rehomed from body onto .popup ---- */
${css}
.popup { width: 340px; }
</style></head>
<body>
  <div class="shot">
    <div class="say">
      <h1>${shot.head}</h1>
      <p>${shot.sub}</p>
      <ul>${shot.pts.map((p) => `<li><b>&check;</b><span>${p}</span></li>`).join('')}</ul>
    </div>
    <div class="lift"><div class="popup">${body}</div></div>
  </div>
  <script type="module" src="chrome-stub.js?state=${shot.state}"></script>
  <script type="module" src="popup.js"></script>
  <script>
    // After the popup has rendered and settled at its real height.
    const fit = () => {
      const lift = document.querySelector('.lift');
      lift.style.transform = 'none';
      const h = lift.getBoundingClientRect().height;
      const room = 800 - 64;
      if (h > room) lift.style.transform = 'scale(' + (room / h).toFixed(4) + ')';
    };
    new MutationObserver(fit).observe(document.querySelector('.popup'), { childList: true, subtree: true });
    setTimeout(fit, 400);
    setTimeout(fit, 1200);
  </script>
</body></html>
`);
}

console.log(`\x1b[32mok\x1b[0m   public/_shot/shot1.html, shot2.html`);
console.log('     open http://localhost:3100/_shot/shot1.html');
