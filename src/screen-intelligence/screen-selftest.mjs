// SI4: the phone self-test. It runs the whole screen-reading chain against AXON's own test screen and returns plain
// PASS / FAIL / SKIP lines. The test screen must contain the labelled items listed in TEST_SCREEN_ITEMS.
import { readPictures } from './picture-reader.mjs';

export const TEST_SCREEN_ITEMS = Object.freeze({
  button: 'AXON test button', counter: 'Test taps:', risky: 'Delete test item', field: 'AXON test field',
  password: 'AXON test password', picture: 'AXON test picture', pictureWords: ['AXON', '47'],
});
const find = (s, label, role) => (s.elements ?? []).find((e) => (!role || e.role === role) && e.label.toLowerCase().startsWith(label.toLowerCase()));
const tapCount = (s) => { const e = find(s, TEST_SCREEN_ITEMS.counter); const m = e && e.label.match(/(\d+)\s*$/); return m ? Number(m[1]) : null; };

export async function runScreenSelfTest({ source, actor, options = {} }) {
  const wait = options.wait ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const lines = [];
  const add = (step, status, text) => lines.push({ step, status, text });
  const finish = () => ({ passed: !lines.some((l) => l.status === 'FAIL'), lines,
    summary: `${lines.filter((l) => l.status === 'PASS').length} passed, ${lines.filter((l) => l.status === 'FAIL').length} failed, ${lines.filter((l) => l.status === 'SKIP').length} skipped` });

  const status = await source.getStatus();
  if (!status.serviceEnabled) { add('Screen reader is on', 'FAIL', `Turn on "AXON screen reader" in Android Settings > Accessibility, then run the test again.${status.reason ? ` (${status.reason})` : ''}`); return finish(); }
  add('Screen reader is on', 'PASS', 'Android reports the AXON screen reader service is running.');

  let screen = await source.readScreen();
  if (!screen.ok || screen.blocked) { add('Read the screen', 'FAIL', `Could not read the screen: ${screen.reason ?? 'blocked'}.`); return finish(); }
  const count = (role) => screen.elements.filter((e) => e.role === role).length;
  add('Read the screen', 'PASS', `Found ${screen.elements.length} items: ${count('button')} buttons, ${count('input')} fields, ${count('image')} pictures, ${count('text')} texts.`);

  const leaked = screen.elements.filter((e) => e.role === 'input' && e.hasValue && !e.redacted);
  add('Typed text and passwords stay hidden', leaked.length ? 'FAIL' : 'PASS', leaked.length ? `${leaked.length} field(s) showed typed text.` : 'Every field with typed text is hidden in the reading.');

  const picture = find(screen, TEST_SCREEN_ITEMS.picture, 'image');
  if (!picture) add('Read text inside a picture', 'SKIP', `The test screen has no picture labelled "${TEST_SCREEN_ITEMS.picture}".`);
  else {
    const read = await readPictures(source, screen);
    const text = (read.imageRegions.find((r) => r.ref === picture.ref)?.text ?? '');
    const pr = read.pictureReading;
    if (!pr.ok) add('Read text inside a picture', pr.code === 'screen-protected' ? 'SKIP' : 'FAIL', `Picture reading stopped: ${pr.code}.${pr.code === 'screenshot-needs-android-11' ? ' This needs Android 11 or newer.' : ''}`);
    else if (TEST_SCREEN_ITEMS.pictureWords.every((w) => text.toUpperCase().includes(w))) add('Read text inside a picture', 'PASS', `Read "${text}" from the test picture.`);
    else add('Read text inside a picture', 'FAIL', `Expected the test picture to contain ${TEST_SCREEN_ITEMS.pictureWords.join(' and ')}, but read "${text}".`);
  }

  const back = await actor.propose({ kind: 'back' });
  add('Gate allows plain navigation', back.proposal.decision === 'allow' ? 'PASS' : 'FAIL', `Back button: ${back.proposal.decision} (${back.proposal.code}). Not pressed.`);

  const pw = find(screen, '[password field]', 'input');
  if (!pw) add('Gate refuses password typing', 'SKIP', 'The test screen has no password field.');
  else { const p = await actor.propose({ kind: 'type', ref: pw.ref, text: 'abc' }); add('Gate refuses password typing', p.proposal.code === 'password-field' ? 'PASS' : 'FAIL', `Typing into the password field: ${p.proposal.decision} (${p.proposal.code}).`); }

  const risky = find(screen, TEST_SCREEN_ITEMS.risky, 'button');
  if (!risky) add('Gate asks before risky taps', 'SKIP', `No "${TEST_SCREEN_ITEMS.risky}" button on the test screen.`);
  else { const p = await actor.propose({ kind: 'tap', ref: risky.ref }); add('Gate asks before risky taps', p.proposal.decision === 'ask' ? 'PASS' : 'FAIL', `Tap on "${TEST_SCREEN_ITEMS.risky}": ${p.proposal.decision} (${p.proposal.code}). Not tapped.`); }

  const button = find(screen, TEST_SCREEN_ITEMS.button, 'button');
  const before = tapCount(screen);
  if (!button || before == null) add('AXON taps a button for you', 'SKIP', 'The test screen needs the test button and the "Test taps: N" text.');
  else {
    const { proposal } = await actor.propose({ kind: 'tap', ref: button.ref });
    // The test screen has a password box, so the gate treats it as a sign-in screen and asks first. Starting the test is the owner's yes for this one tap.
    const askedForSignIn = proposal.decision === 'ask' && proposal.code === 'sign-in-screen';
    const done = proposal.decision === 'allow' || askedForSignIn ? await actor.execute(proposal, { approved: askedForSignIn }) : { ok: false, code: `gate-${proposal.decision}` };
    await wait(options.settleMs ?? 700);
    screen = await source.readScreen();
    const after = screen.ok ? tapCount(screen) : null;
    add('AXON taps a button for you', done.ok && after === before + 1 ? 'PASS' : 'FAIL', done.ok ? `Taps went from ${before} to ${after}${askedForSignIn ? ' (the gate asked first because of the password box; starting the test counted as your yes)' : ''}.` : `The tap did not run (${done.code}).`);
  }

  const field = find(screen, TEST_SCREEN_ITEMS.field, 'input');
  if (!options.approveTyping) add('AXON types for you', 'SKIP', 'Tick "I approve the typing test" to include this step.');
  else if (!field) add('AXON types for you', 'SKIP', `No field labelled "${TEST_SCREEN_ITEMS.field}".`);
  else {
    const { proposal } = await actor.propose({ kind: 'type', ref: field.ref, text: 'hello axon' });
    const done = await actor.execute(proposal, { approved: proposal.decision === 'ask' });
    await wait(options.settleMs ?? 700);
    screen = await source.readScreen();
    const after = screen.ok ? find(screen, TEST_SCREEN_ITEMS.field, 'input') : null;
    add('AXON types for you', done.ok && after?.hasValue ? 'PASS' : 'FAIL', done.ok ? 'The field now has text (the text itself stays hidden).' : `Typing did not run (${done.code}).`);
  }
  return finish();
}
