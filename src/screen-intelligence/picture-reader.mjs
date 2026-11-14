// SI5a: reads the TEXT inside pictures on screen. Pixels never enter this file: it cuts crop rectangles from the
// reader's image regions, asks the native recogniser for text, cleans the text, and attaches it to the structure.
import { planCrops, describeScreen } from './structure-reader.mjs';

function luhn(d) {
  let sum = 0;
  for (let i = 0; i < d.length; i += 1) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Tidy recognised text; card-like numbers are removed; long text is cut. */
export function cleanPictureText(text, maxChars = 300) {
  let t = String(text ?? '').replace(/\s+/g, ' ').trim();
  t = t.replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => (luhn(m.replace(/[ -]/g, '')) ? '[number removed]' : m));
  return t.length > maxChars ? `${t.slice(0, maxChars)}…` : t;
}

export async function readPictures(source, structure, { maxPictures = 8, minSize = 48, maxChars = 300 } = {}) {
  const fail = (code) => ({ ...structure, pictureReading: { ok: false, code } });
  if (!structure?.ok || structure.blocked) return fail('no-screen');
  if (!(structure.imageRegions ?? []).length) return { ...structure, pictureReading: { ok: true, code: 'no-pictures', read: 0, withText: 0 } };
  const { crops, reason } = planCrops(structure, { frameWidth: structure.screen?.width, frameHeight: structure.screen?.height, minSize, maxCrops: maxPictures });
  if (!crops.length) return { ...structure, pictureReading: { ok: true, code: reason ?? 'no-usable-pictures', read: 0, withText: 0 } };
  const res = await source.recognizeRegions(crops.map(({ ref, x, y, width, height }) => ({ ref, x, y, width, height })));
  if (!res?.ok) return fail(res?.code ?? 'recognize-failed');
  const found = new Map((res.regions ?? []).map((r) => [r.ref, cleanPictureText(r.text, maxChars)]));
  const elements = structure.elements.map((e) => (found.has(e.ref) ? { ...e, pictureText: found.get(e.ref) } : e));
  const imageRegions = structure.imageRegions.map((r) => (found.has(r.ref) ? { ...r, text: found.get(r.ref) } : r));
  const withText = [...found].filter(([, t]) => t);
  const outline = describeScreen({ elements, packageName: structure.packageName, windowTitle: structure.windowTitle })
    + (withText.length ? `\nText found inside pictures:\n${withText.map(([ref, t]) => `[${ref}] "${t}"`).join('\n')}` : '');
  return { ...structure, elements, imageRegions, outline, pictureReading: { ok: true, code: 'ok', read: crops.length, withText: withText.length } };
}
