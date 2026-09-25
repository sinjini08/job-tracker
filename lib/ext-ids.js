// Which browser extensions this tracker will talk to.
//
// Read from the environment, never from a URL or a request. Both the pairing
// page and /api/ext need the same list: one decides who may be handed a
// token, the other decides whose origin may call the endpoint at all.
export const EXTENSION_IDS = String(process.env.EXTENSION_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  // A Chrome extension id is 32 characters, a to p. Anything else in that
  // variable is a mistake and is dropped rather than trusted.
  .filter((s) => /^[a-p]{32}$/.test(s));

// The popup runs on chrome-extension://<id>, which is a cross-origin caller
// like any other. Only an allowlisted one gets an answer.
export function allowedOrigin(origin) {
  if (!origin) return null;
  const id = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin)?.[1];
  return id && EXTENSION_IDS.includes(id) ? origin : null;
}
