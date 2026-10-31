/**
 * B04A action schemas: meaning, typed inputs, effects, preconditions, estimated cost and undo.
 * Concepts are dictionary lemmas; technical names are used only when absent from that dictionary.
 */
import { VALUE_KIND_LABELS } from './schemaTypes';
import type { ActionSchema, Act, SlotKind, Effect, Precondition, CostTime, CostMemory, UndoKind, ValueKind } from './schemaTypes';

const DATA = `
text-counter | c a | count measure | word:n line:n character:n letter:n |  | text:text:r unit:choice:o | shows-result |  | quick low | not-needed
interface-capture | c a | capture export | interface:n source:n |  |  | writes-file |  | slow mid | by-removal
content-extractor | c a | extract organize | content:n material:n |  |  | shows-result |  | quick low | not-needed
link-analyzer | c a | analyze detect | link:n destination:n |  |  | shows-result |  | quick low | not-needed
background-proof | c a | prove monitor | heartbeat:n background:n |  |  | shows-result |  | quick low | not-needed
ai-assistant | c a | assist explain | assistant:n question:n |  |  | shows-result |  | quick low | not-needed
collage-maker | c a | make arrange | collage:n picture:n |  |  | writes-file |  | slow high | by-removal
picture-to-table | c a | convert draw | picture:n table:n |  |  | writes-file |  | slow mid | by-removal
audio-converter | c a | convert change | audio:n sound:n |  |  | writes-file |  | slow high | by-removal
text-to-speech | c a | speak read | speech:n voice:n |  |  | writes-file |  | slow mid | by-removal
voice-library | c a | adjust choose | voice:n pitch:n |  |  | changes-setting |  | quick low | by-tool
voice-cloner | c a | clone imitate | voice:n pattern:n |  |  | changes-setting | owner-approval | slow high | by-tool
speech-to-text | c a | transcribe convert | speech:n transcript:n |  |  | uses-microphone | permission device-capable | slow high | not-needed
video-frames | c a | extract select | video:n frame:n |  | video:file:r selection:choice:o deviceTier:choice:o | reads-file writes-file |  | slow high | by-removal
video-converter | c a | convert change | video:n container:n |  |  | writes-file |  | slow high | by-removal
video-maker | c a | make combine | video:n clip:n |  |  | writes-file |  | slow high | by-removal
video-downloader | c a | download save | video:n link:n |  |  | uses-network writes-file | permission network-on | slow high | by-removal
file-converter | c a | convert change | file:n extension:n |  | file:file:r to:choice:r options:text:r | reads-file writes-file |  | slow mid | by-removal
zip-tool | c a | pack unpack | archive:n file:n |  | files:file:r archive:file:r entryName:text:o store:yes-no:o | reads-file writes-file |  | slow mid | by-removal
pdf-tools | c a | merge split | document:n page:n | pdf |  | writes-file |  | slow high | by-removal
document-converter | c a | convert change | document:n manuscript:n |  |  | writes-file |  | slow mid | by-removal
batch-convert | c a | convert handle | batch:n file:n |  | files:file:r to:choice:r maxHeldBytes:number:o | reads-file writes-file |  | slow high | by-removal
file-inspector | c a | inspect measure | file:n size:n |  | file:file:r | reads-file shows-result |  | quick low | not-needed
file-compare | c a | compare detect | file:n comparison:n |  | fileA:file:r fileB:file:r mode:choice:r | reads-file shows-result |  | slow mid | not-needed
converter | c a | convert calculate | unit:n quantity:n |  | text:text:r delimiter:choice:o header:yes-no:o detectTypes:yes-no:o rootName:text:o indent:choice:o image:file:o toFormat:choice:r maxSide:number:o html:text:o from:choice:r to:choice:r input:text:r | reads-file writes-file |  | slow high | by-removal | quantity
find-replace | c a | find replace | text:n replacement:n occurrence:n |  | text:text:r pattern:text:r replacement:text:o caseSensitive:yes-no:o wholeWord:yes-no:o regex:yes-no:o replaceAll:yes-no:o | shows-result |  | quick low | not-needed
case-converter | c a | convert change | case:n letter:n upper:a lower:a lowercase:a uppercase:a |  | text:text:r mode:choice:r | shows-result |  | quick low | not-needed
text-cleaner | c a | clean remove | text:n space:n line:n blank:a duplicate:a |  | text:text:r trimEachLine:yes-no:o collapseRepeatedSpaces:yes-no:o removeBlankLines:yes-no:o collapseBlankLines:yes-no:o straightenQuotesAndDashes:yes-no:o removeZeroWidth:yes-no:o normalizeLineEndings:yes-no:o | shows-result |  | quick low | not-needed
sort-lines | c a | sort remove | line:n order:n |  | text:text:r mode:choice:r ignoreCase:yes-no:o removeDuplicates:yes-no:o ignoreBlankLines:yes-no:o | shows-result |  | quick low | not-needed
text-compare | c a | compare detect | text:n passage:n difference:n |  | original:text:r revised:text:r mode:choice:r | shows-result |  | quick low | not-needed
rephraser | c a | rephrase change | sentence:n wording:n version:n |  |  | shows-result |  | quick low | not-needed
grammar-helper | c a | explain detect | grammar:n sentence:n mistake:n |  |  | shows-result |  | quick low | not-needed
calculator | c a | calculate evaluate | expression:n number:n |  | expression:text:r angle:choice:r | shows-result |  | quick low | not-needed
number-to-words | c a | convert spell | number:n word:n |  | number:number:r ordinal:yes-no:o | shows-result |  | quick low | not-needed
percentage-helper | c a | calculate compare | percentage:n change:n |  | mode:choice:r values:text:r | shows-result |  | quick low | not-needed | percent
timer | c a | count measure | timer:n duration:n |  | durationMs:duration:r operation:choice:r now:time:o | shows-result |  | quick low | not-needed | duration
stopwatch | c a | measure record | stopwatch:n lap:n |  | operation:choice:r now:time:o | shows-result |  | quick low | not-needed
date-calculator | c a | calculate count | date:n interval:n |  | operation:choice:r date:date:r otherDate:date:o amount:number:o unit:choice:o | shows-result |  | quick low | not-needed | date
tally-counter | c a | count change | counter:n tally:n |  | operation:choice:r name:text:r value:number:r step:number:o min:number:o max:number:o | shows-result |  | quick low | not-needed
qr-maker | c a | encode make | code:n image:n text:n link:n | qr | text:text:r level:choice:r | shows-result |  | quick low | not-needed
password-generator | c a | generate create | password:n length:n strong:a |  | length:number:r options:text:r random:text:o | shows-result |  | quick low | not-needed
random-picker | c a | choose pick shuffle | random:a item:n |  | operation:choice:r items:text:r count:number:r random:text:o | shows-result |  | quick low | not-needed
encoder-decoder | c a | encode decode | encoding:n text:n hexadecimal:a | base64 url | mode:choice:r format:choice:r input:text:r | shows-result |  | quick low | not-needed
hash-tool | c a | calculate check | hash:n checksum:n text:n file:n |  | input:text:r algorithm:choice:r | shows-result |  | quick low | not-needed
dictionary | c a | define explain | dictionary:n word:n |  |  | shows-result |  | quick low | not-needed
my-dictionary | c a | store search | meaning:n entry:n |  | word:text:r meaning:text:r partOfSpeech:choice:o file:file:r confirm:yes-no:o | reads-file stores-note | owner-approval | slow mid | by-tool
document-reader | c a | read search | document:n heading:n |  | file:file:r | reads-file shows-result |  | slow mid | not-needed
translator | c a | translate convert | language:n meaning:n |  |  | shows-result |  | quick low | not-needed
summarizer | c a | select shorten | summary:n sentence:n |  | text:text:r sentences:number:r | shows-result |  | quick low | not-needed
json-viewer | c a | inspect validate | data:n structure:n | json | text:text:r indent:choice:o path:text:o offset:number:o limit:number:o | shows-result |  | quick low | not-needed
web-search | c a | search find | web:n result:n |  |  | uses-network shows-result | permission network-on | slow mid | not-needed
axon-code | c a | write test | code:n program:n |  |  | shows-result |  | quick low | not-needed
code-formatter | c a | format change | code:n format:n |  | language:choice:r mode:choice:r indent:choice:o input:text:r | shows-result |  | quick low | not-needed
pattern-tester | c a | test inspect | pattern:n match:n |  | pattern:text:r flags:text:o text:text:r replacement:text:o | shows-result |  | quick low | not-needed
currency-converter | c a | convert calculate | currency:n exchange:n |  |  | uses-network shows-result | permission network-on | slow low | not-needed
loan-calculator | c a | calculate estimate | loan:n repayment:n |  | amount:number:o yearlyRate:number:r term:duration:r extraPayment:number:o | shows-result |  | quick low | not-needed
split-bill | c a | divide calculate | bill:n share:n |  | bill:number:r tipPercent:number:r people:number:r roundUp:yes-no:o | shows-result |  | quick low | not-needed
market-scope | c a | analyze study | market:n trend:n |  |  | shows-result |  | quick low | not-needed
device-profile | c a | report inspect | device:n memory:n |  | environment:text:o | shows-result |  | quick low | not-needed
backup-restore | c a | save restore | backup:n data:n |  |  | writes-file | owner-approval | slow high | by-removal
settings | c a | open change | setting:n preference:n |  |  | changes-setting |  | quick low | by-tool
taught-meanings | c a | teach forget | meaning:n lesson:n |  |  | stores-note deletes | owner-approval | quick low | by-tool
axon-source | c a | export create | source:n project:n |  |  | writes-file |  | slow high | by-removal
`;

function words(value: string): string[] {
  return value === '' ? [] : value.split(' ');
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function make(row: string): ActionSchema {
  const columns = row.split('|').map((part) => part.trim());
  const [tool, actCodes, actionWords, objectWords, nameWords, slotWords, effectWords, preWords, costWords, undo, valueWords] = columns;
  const acts = words(actCodes!).map((act) => act === 'c' ? 'command' : 'ask') as Act[];
  const actions = words(actionWords!).map((word) => word + ':v');
  const objects = words(objectWords!);
  const names = words(nameWords!);
  const slots = words(slotWords!).map((slot) => {
    const parts = slot.split(':');
    return { name: parts[0]!, kind: parts[1] as SlotKind, required: parts[2] === 'r' };
  });
  const effects = words(effectWords!) as Effect[];
  const preconditions = words(preWords!) as Precondition[];
  const costs = words(costWords!);
  const values = words(valueWords ?? '').filter((value) => VALUE_KIND_LABELS.split(' ').includes(value)) as ValueKind[];
  return {
    tool: tool!,
    acts,
    actions,
    objects,
    names,
    slots,
    effects,
    preconditions,
    cost: { time: costs[0] as CostTime, memory: costs[1] as CostMemory, basis: 'estimate' },
    undo: undo as UndoKind,
    ...(values.length > 0 ? { values } : {})
  };
}

export const ACTION_SCHEMAS: readonly ActionSchema[] = deepFreeze(
  DATA.split('\n').filter((row) => row.trim() !== '').map(make)
);

const byTool = new Map<string, ActionSchema>();
const byConcept = new Map<string, string[]>();
const byName = new Map<string, string[]>();

for (const schema of ACTION_SCHEMAS) {
  byTool.set(schema.tool, schema);
  const concepts = new Set([...schema.actions, ...schema.objects]);
  for (const concept of concepts) {
    const ids = byConcept.get(concept) ?? [];
    ids.push(schema.tool);
    byConcept.set(concept, ids);
  }
  for (const name of schema.names) {
    const ids = byName.get(name) ?? [];
    ids.push(schema.tool);
    byName.set(name, ids);
  }
}

export function getSchema(tool: string): ActionSchema | null {
  if (typeof tool !== 'string') return null;
  return byTool.get(tool) ?? null;
}

export function listSchemas(): ActionSchema[] {
  return [...ACTION_SCHEMAS];
}

export function schemasByConcept(concept: string): string[] {
  if (typeof concept !== 'string') return [];
  return [...(byConcept.get(concept) ?? [])];
}

export function schemasByName(name: string): string[] {
  if (typeof name !== 'string') return [];
  return [...(byName.get(name) ?? [])];
}
