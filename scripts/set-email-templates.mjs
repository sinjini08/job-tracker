// Set the sign-in email templates through the Supabase Management API, then
// read them back to confirm. Use when the dashboard editor won't save.
//   node scripts/set-email-templates.mjs
// Needs a personal access token (supabase.com/dashboard/account/tokens). It's
// read hidden, used for this run only, and never printed or saved. Revoke it
// afterwards.
import readline from 'node:readline';

const PROJECT = 'pnlzjqdcxcpznqwhkynm';
const BODY = `<h2>Your Job Tracker sign-in code</h2>
<p>Enter this code on the sign-in page:</p>
<p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:16px 0">{{ .Token }}</p>
<p>Or, on the device where you requested it, <a href="{{ .ConfirmationURL }}">click here to sign in</a>.</p>
<p style="color:#666;font-size:13px">The code expires in an hour. If you didn't try to sign in, you can ignore this email.</p>`;

const WANT = {
  mailer_subjects_magic_link: 'Your Job Tracker sign-in code',
  mailer_templates_magic_link_content: BODY,
  mailer_subjects_confirmation: 'Welcome to Job Tracker: your sign-in code',
  mailer_templates_confirmation_content: BODY,
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
const write = rl._writeToOutput?.bind(rl);
let muted = false;
rl._writeToOutput = (s) => { if (!muted) write(s); };
process.stdout.write('Supabase personal access token (hidden): ');
muted = true;
const token = (await new Promise((r) => rl.once('line', r))).trim();
muted = false;
rl.close();
process.stdout.write('\n');

const api = async (method, body) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/config/auth`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
};

const show = (cfg, label) => {
  console.log(`\n${label}`);
  for (const [k, name] of [['magic_link', 'Magic link or OTP'], ['confirmation', 'Confirm signup'],
    ['recovery', 'Reset password'], ['reauthentication', 'Reauthentication']]) {
    const body = cfg[`mailer_templates_${k}_content`] ?? '(default)';
    console.log(`  ${name}: subject "${cfg[`mailer_subjects_${k}`] ?? '(default)'}"`);
    console.log(`    body: ${body.replace(/\s+/g, ' ').slice(0, 90)}${body.length > 90 ? '…' : ''}`);
    console.log(`    has {{ .Token }}: ${body.includes('{{ .Token }}') ? 'yes' : 'NO'}`);
  }
};

try {
  show(await api('GET'), 'Saved on Supabase right now:');
  await api('PATCH', WANT);
  const after = await api('GET');
  show(after, 'After update:');
  const ok = Object.entries(WANT).every(([k, v]) => after[k] === v);
  console.log(ok ? '\n✅ Templates saved. Request a new code on the site to test.'
                 : '\n❌ Supabase didn\'t keep the change. Send Claude this output.');
  console.log('Now revoke the token at https://supabase.com/dashboard/account/tokens');
} catch (e) {
  console.log('⚠️ ', e.message);
}
