// Check a Gmail app password works for SMTP, without Supabase in the way.
//   node scripts/check-gmail-smtp.mjs
// The password is read hidden and never printed or saved.
import tls from 'node:tls';
import readline from 'node:readline';

// Lines are queued so this works both typed (TTY) and piped.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
let muted = false;
const write = rl._writeToOutput?.bind(rl);
rl._writeToOutput = (s) => { if (!muted) write(s); };
const lines = [];
let waiting = null;
rl.on('line', (l) => { if (waiting) { const w = waiting; waiting = null; w(l); } else lines.push(l); });
const ask = (q, hidden = false) => {
  process.stdout.write(q);
  muted = hidden;
  return new Promise((resolve) => {
    const done = (a) => { muted = false; if (hidden) process.stdout.write('\n'); resolve(a); };
    if (lines.length) done(lines.shift()); else waiting = done;
  });
};

const user = (await ask('Gmail address [easy.jobtracker@gmail.com]: ')).trim() || 'easy.jobtracker@gmail.com';
const pass = (await ask('App password (hidden; spaces are fine): ', true)).replace(/\s/g, '');
rl.close();
console.log(`Password length: ${pass.length} (an app password is 16)`);

const sock = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' });
sock.setEncoding('utf8');
let buf = '';
const reply = () => new Promise((resolve) => {
  const onData = (d) => {
    buf += d;
    const lines = buf.split('\r\n').filter(Boolean);
    const last = lines[lines.length - 1];
    if (last && /^\d{3} /.test(last)) { sock.off('data', onData); const out = buf; buf = ''; resolve(out); }
  };
  sock.on('data', onData);
});
sock.on('error', (e) => { console.log('⚠️  Couldn\'t reach Gmail:', e.message); process.exit(1); });

await reply();                                   // 220 greeting
sock.write('EHLO check\r\n'); await reply();
sock.write(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}\r\n`);
const res = await reply();
sock.write('QUIT\r\n'); sock.end();

if (res.startsWith('235')) {
  console.log('✅ Gmail accepted this address + app password. Put exactly these in Supabase\'s SMTP settings.');
} else {
  console.log('❌ Gmail rejected them:', res.split('\r\n')[0]);
  console.log(`   Make a new app password while signed in as ${user} and try again.`);
}
