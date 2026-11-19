/** Director 471 (ROUND-ALL): real-brain proof for Password Generator. Random tool: properties, never values. Defaults (16 characters; upper, lower, digits, symbols) are said aloud. */
import { runLiveProof, makeSlot, type ProofReply } from './helpers/liveProof';
import { createAxonBrain } from '../src/brain/index';
import { getAxonEngine } from '../src/kernel/axonEngine';
const LOWER = 'abcdefghijklmnopqrstuvwxyz'; const UPPER = LOWER.toUpperCase(); const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/\\|~`\'"<>';
const POOL = LOWER + UPPER + DIGITS + SYMBOLS; // hand-listed: 26 + 26 + 10 + 32 = 94
if (POOL.length !== 94) throw new Error('pool is hand-counted as 94');
const seen = new Set<string>();
const length = (n: number, spoken: boolean) => (reply: ProofReply): string | null => {
  const at = reply.content.indexOf('Password: '); const end = reply.content.indexOf('. Entropy: ');
  if (at < 0 || end < 0) return 'no password line';
  const pw = reply.content.slice(at + 10, end);
  if (pw.length !== n) return `length ${pw.length} instead of ${n}`;
  for (const ch of pw) if (!POOL.includes(ch)) return 'character outside the 94 allowed: ' + ch;
  const bits = Number(reply.content.slice(end + 11, reply.content.indexOf(' bits', end)));
  if (!(Math.abs(bits - n * Math.log2(94)) < 0.01)) return 'entropy ' + bits;
  if (reply.taskId === undefined) return 'no task record';
  if (spoken && !reply.content.includes('16 character password')) return 'the default length was not said aloud';
  if (!spoken && reply.content.includes('16 character password') && n !== 16) return 'default said although a length was given';
  if (n >= 12) { if (seen.has(pw)) return 'the same password twice'; seen.add(pw); }
  return null;
};
const A = (text: string, n: number, spoken = false): readonly [string, (r: ProofReply) => string | null] => [text, length(n, spoken)];
await runLiveProof({
  name: 'liveBrainPassword', toolId: 'password-generator',
  answers: [
    A('generate a 20 character password', 20), A('generate a password', 16, true), A('create a 12 character password', 12), A('create a 32 character password', 32),
    A('generate an 8 character password', 8), A('please generate a 64 character password', 64), A('generate a password with 24 characters', 24),
    A('create a 10 character password', 10), A('generate a 100 character password', 100), A('generate a 4 character password', 4),
    A('generate a 128 character password', 128), A('create an 18 character password', 18), A('generate a secure 25 character password', 25),
    A('create a password', 16, true), A('make a password', 16, true), A('Generate a 30 character password', 30), A('GENERATE A 14 CHARACTER PASSWORD', 14),
    A('generate a 40-character password', 40), A('generate a 21 character password please', 21), A('generate a 16 character password', 16),
    A('generate a 50 character password', 50), A('generate a 9 character password', 9),
  ],
  mustNot: [
    'how do I generate a password?', 'what makes a strong password?', 'generate a 20 character password without symbols', 'generate a password with only digits',
    'generate a password for my wifi', 'create a password manager', 'generate a 3 character password', 'generate a 200 character password',
    'generate a 20 character password and hash it', 'reveal my password', 'recover my password', 'generate a memorable password', 'generate a passphrase',
    'generate a 6 digit pin', 'do not generate a password', 'never create a 20 character password', 'my password is 12 characters', 'generate a 20 character password using uppercase letters',
    'generate a 20 character password with numbers', 'change my password', 'I need a 14 character password', 'generate a password in python', 'write a function to generate a password',
    'generate a random number', 'generate two passwords', 'generate a 20 character password and email it to me', 'I forgot my password', 'what is a password?', 'create a password hint',
    'generate a 20 character password and then another', 'generate a password ' + 'x'.repeat(2000),
  ],
  others: ['hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42', 'sort the lines "b\na"', 'count words in "one two three"', 'create QR code containing "hello"', 'encode "hello" as base64', 'replace "cat" with "fox" in "the cat sat"', 'hash "abc" with sha-256'],
});

// EVIDENCE TRUTH: the task record holds exactly the password that was shown (not a second one).
const brain = createAxonBrain({ lane: true, slot: await makeSlot() });
for (const text of ['generate a 20 character password', 'generate a password']) {
  const reply = (await brain.askWithTrace({ text, place: 'chat' })).reply;
  const pw = reply.content.slice(reply.content.indexOf('Password: ') + 10, reply.content.indexOf('. Entropy: '));
  const done = await getAxonEngine().whenDone(String(reply.taskId));
  const out = done.output as { password?: string } | undefined;
  if (out?.password !== pw) throw new Error('liveBrainPassword FAILED: the task record differs from the shown password');
}
console.log('EVIDENCE TRUTH: the task record holds exactly the shown password (2 of 2)');
