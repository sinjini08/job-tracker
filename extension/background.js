// The only reason this file exists.
//
// A popup closes the moment focus leaves it, which is the moment the connect
// page opens. So something has to still be listening when the tracker sends
// the token back, and that has to be the service worker. It does nothing else,
// and it stays asleep until a message arrives.
//
// Only the tracker can send anything here at all: externally_connectable in
// the manifest names one origin, and Chrome refuses messages from anywhere
// else before this code runs. The checks below are for the case where that
// origin is serving something it should not be.

const ENDPOINT = /^https:\/\/[^\s/]+\/api\/ext\/[A-Za-z0-9_-]{20,}$/;

chrome.runtime.onMessageExternal.addListener((message, sender, reply) => {
  // Belt and braces over the manifest: the sender's origin has to be the
  // page's own, and https, so a subresource on that origin cannot pair the
  // extension to somewhere else.
  let origin;
  try { origin = new URL(sender.url ?? '').origin; } catch { origin = ''; }
  if (!origin.startsWith('https://')) { reply({ ok: false, error: 'Insecure origin.' }); return true; }

  if (message?.type !== 'jt-pair') { reply({ ok: false, error: 'Unknown message.' }); return true; }

  const endpoint = String(message.endpoint ?? '');
  // The token must point back at the site that sent it. Without this, a page
  // on the tracker's origin could pair the extension to an endpoint somebody
  // else controls, and every posting saved afterwards would go there.
  if (!ENDPOINT.test(endpoint) || new URL(endpoint).origin !== origin) {
    reply({ ok: false, error: 'That link does not belong to this site.' });
    return true;
  }

  chrome.storage.local.set({ endpoint }, () => {
    reply({ ok: true });
  });
  return true; // the reply is sent after the write, so keep the channel open
});
