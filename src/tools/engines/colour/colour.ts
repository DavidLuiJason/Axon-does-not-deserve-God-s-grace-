export const COLOUR_LIMITS = { maxInputLength: 64, channelMin: 0, channelMax: 255 } as const;
export type RGB = { r: number; g: number; b: number };
export type ColourError = 'input-too-long' | 'empty-input' | 'invalid-format' | 'invalid-channel' | 'unknown-name' | 'invalid-colour';
export type ColourResult = { ok: true; colour: RGB } | { ok: false; error: ColourError; message: string };
export type NameResult = { name: string; exact: boolean; aliases: string[] };
export type ColourDescription = { hex: string; rgb: string; hsl: string; name: string; exact: boolean; aliases: string[] };

// CSS Color Module Level 4 named colours; table independently checked against Python matplotlib CSS4_COLORS (148 entries).
const CSS_NAMES: Readonly<Record<string, string>> = {
  'aliceblue': 'F0F8FF',
  'antiquewhite': 'FAEBD7',
  'aqua': '00FFFF',
  'aquamarine': '7FFFD4',
  'azure': 'F0FFFF',
  'beige': 'F5F5DC',
  'bisque': 'FFE4C4',
  'black': '000000',
  'blanchedalmond': 'FFEBCD',
  'blue': '0000FF',
  'blueviolet': '8A2BE2',
  'brown': 'A52A2A',
  'burlywood': 'DEB887',
  'cadetblue': '5F9EA0',
  'chartreuse': '7FFF00',
  'chocolate': 'D2691E',
  'coral': 'FF7F50',
  'cornflowerblue': '6495ED',
  'cornsilk': 'FFF8DC',
  'crimson': 'DC143C',
  'cyan': '00FFFF',
  'darkblue': '00008B',
  'darkcyan': '008B8B',
  'darkgoldenrod': 'B8860B',
  'darkgray': 'A9A9A9',
  'darkgreen': '006400',
  'darkgrey': 'A9A9A9',
  'darkkhaki': 'BDB76B',
  'darkmagenta': '8B008B',
  'darkolivegreen': '556B2F',
  'darkorange': 'FF8C00',
  'darkorchid': '9932CC',
  'darkred': '8B0000',
  'darksalmon': 'E9967A',
  'darkseagreen': '8FBC8F',
  'darkslateblue': '483D8B',
  'darkslategray': '2F4F4F',
  'darkslategrey': '2F4F4F',
  'darkturquoise': '00CED1',
  'darkviolet': '9400D3',
  'deeppink': 'FF1493',
  'deepskyblue': '00BFFF',
  'dimgray': '696969',
  'dimgrey': '696969',
  'dodgerblue': '1E90FF',
  'firebrick': 'B22222',
  'floralwhite': 'FFFAF0',
  'forestgreen': '228B22',
  'fuchsia': 'FF00FF',
  'gainsboro': 'DCDCDC',
  'ghostwhite': 'F8F8FF',
  'gold': 'FFD700',
  'goldenrod': 'DAA520',
  'gray': '808080',
  'green': '008000',
  'greenyellow': 'ADFF2F',
  'grey': '808080',
  'honeydew': 'F0FFF0',
  'hotpink': 'FF69B4',
  'indianred': 'CD5C5C',
  'indigo': '4B0082',
  'ivory': 'FFFFF0',
  'khaki': 'F0E68C',
  'lavender': 'E6E6FA',
  'lavenderblush': 'FFF0F5',
  'lawngreen': '7CFC00',
  'lemonchiffon': 'FFFACD',
  'lightblue': 'ADD8E6',
  'lightcoral': 'F08080',
  'lightcyan': 'E0FFFF',
  'lightgoldenrodyellow': 'FAFAD2',
  'lightgray': 'D3D3D3',
  'lightgreen': '90EE90',
  'lightgrey': 'D3D3D3',
  'lightpink': 'FFB6C1',
  'lightsalmon': 'FFA07A',
  'lightseagreen': '20B2AA',
  'lightskyblue': '87CEFA',
  'lightslategray': '778899',
  'lightslategrey': '778899',
  'lightsteelblue': 'B0C4DE',
  'lightyellow': 'FFFFE0',
  'lime': '00FF00',
  'limegreen': '32CD32',
  'linen': 'FAF0E6',
  'magenta': 'FF00FF',
  'maroon': '800000',
  'mediumaquamarine': '66CDAA',
  'mediumblue': '0000CD',
  'mediumorchid': 'BA55D3',
  'mediumpurple': '9370DB',
  'mediumseagreen': '3CB371',
  'mediumslateblue': '7B68EE',
  'mediumspringgreen': '00FA9A',
  'mediumturquoise': '48D1CC',
  'mediumvioletred': 'C71585',
  'midnightblue': '191970',
  'mintcream': 'F5FFFA',
  'mistyrose': 'FFE4E1',
  'moccasin': 'FFE4B5',
  'navajowhite': 'FFDEAD',
  'navy': '000080',
  'oldlace': 'FDF5E6',
  'olive': '808000',
  'olivedrab': '6B8E23',
  'orange': 'FFA500',
  'orangered': 'FF4500',
  'orchid': 'DA70D6',
  'palegoldenrod': 'EEE8AA',
  'palegreen': '98FB98',
  'paleturquoise': 'AFEEEE',
  'palevioletred': 'DB7093',
  'papayawhip': 'FFEFD5',
  'peachpuff': 'FFDAB9',
  'peru': 'CD853F',
  'pink': 'FFC0CB',
  'plum': 'DDA0DD',
  'powderblue': 'B0E0E6',
  'purple': '800080',
  'rebeccapurple': '663399',
  'red': 'FF0000',
  'rosybrown': 'BC8F8F',
  'royalblue': '4169E1',
  'saddlebrown': '8B4513',
  'salmon': 'FA8072',
  'sandybrown': 'F4A460',
  'seagreen': '2E8B57',
  'seashell': 'FFF5EE',
  'sienna': 'A0522D',
  'silver': 'C0C0C0',
  'skyblue': '87CEEB',
  'slateblue': '6A5ACD',
  'slategray': '708090',
  'slategrey': '708090',
  'snow': 'FFFAFA',
  'springgreen': '00FF7F',
  'steelblue': '4682B4',
  'tan': 'D2B48C',
  'teal': '008080',
  'thistle': 'D8BFD8',
  'tomato': 'FF6347',
  'turquoise': '40E0D0',
  'violet': 'EE82EE',
  'wheat': 'F5DEB3',
  'white': 'FFFFFF',
  'whitesmoke': 'F5F5F5',
  'yellow': 'FFFF00',
  'yellowgreen': '9ACD32',
};
const fail = (error: ColourError, message: string): ColourResult => ({ ok: false, error, message });
function integerPart(text: string): number | null {
  if (text.length === 0) return null;
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 48 || c > 57) return null;
    n = n * 10 + c - 48;
    if (n > 1000000) return null;
  }
  return n;
}
function splitArgs(body: string): string[] | null {
  const parts: string[] = []; let start = 0;
  for (let i = 0; i <= body.length; i++) {
    if (i === body.length || body[i] === ',') {
      const part = body.slice(start, i).trim(); if (!part) return null;
      parts.push(part); start = i + 1;
    }
  }
  return parts;
}
function parseFunction(text: string, prefix: 'rgb' | 'hsl'): ColourResult {
  if (text.length < prefix.length + 2 || text.slice(0, prefix.length).toLowerCase() !== prefix || text[prefix.length] !== '(' || text[text.length - 1] !== ')') return fail('invalid-format', 'Expected '+prefix+'(…) with three comma-separated integer values.');
  const args = splitArgs(text.slice(prefix.length + 1, -1));
  if (!args || args.length !== 3) return fail('invalid-format', 'Expected exactly three comma-separated values.');
  if (prefix === 'rgb') {
    const values = args.map(integerPart);
    if (values.some(v => v === null || v < 0 || v > 255)) return fail('invalid-channel', 'RGB channels must be whole numbers from 0 to 255.');
    return { ok: true, colour: { r: values[0]!, g: values[1]!, b: values[2]! } };
  }
  const hue = integerPart(args[0]);
  if (hue === null || !args[1].endsWith('%') || !args[2].endsWith('%')) return fail('invalid-channel', 'HSL requires whole-number hue and percentage saturation and lightness.');
  const sat = integerPart(args[1].slice(0, -1)), light = integerPart(args[2].slice(0, -1));
  if (sat === null || light === null || sat > 100 || light > 100) return fail('invalid-channel', 'HSL saturation and lightness must be percentages from 0% to 100%.');
  return { ok: true, colour: fromHsl({ h: hue, s: sat, l: light }) };
}
export function parseColour(input: string): ColourResult {
  if (typeof input !== 'string') return fail('invalid-format', 'Colour input must be text.');
  if (input.length > COLOUR_LIMITS.maxInputLength) return fail('input-too-long', 'Colour input exceeds 64 characters.');
  const text = input.trim(); if (!text) return fail('empty-input', 'Enter a colour name or colour value.');
  if (text[0] === '#') {
    const hex = text.slice(1); let expanded = '';
    if (hex.length === 3) { for (const c of hex) { const v = hexDigit(c); if (v < 0) return fail('invalid-format', 'Hex colours use only hexadecimal digits.'); expanded += c + c; } }
    else if (hex.length === 6) { for (const c of hex) if (hexDigit(c) < 0) return fail('invalid-format', 'Hex colours use only hexadecimal digits.'); expanded = hex; }
    else return fail('invalid-format', 'Hex colours must use #rgb or #rrggbb.');
    return { ok: true, colour: { r: hexByte(expanded, 0), g: hexByte(expanded, 2), b: hexByte(expanded, 4) } };
  }
  const lower = text.toLowerCase();
  if (lower.startsWith('rgb')) return parseFunction(text, 'rgb');
  if (lower.startsWith('hsl')) return parseFunction(text, 'hsl');
  const named = CSS_NAMES[lower];
  if (named !== undefined) return { ok: true, colour: { r: hexByte(named, 0), g: hexByte(named, 2), b: hexByte(named, 4) } };
  return fail('unknown-name', 'Unknown CSS colour name or unsupported colour format.');
}
function hexDigit(c: string): number { const n = c.charCodeAt(0); if (n >= 48 && n <= 57) return n - 48; if (n >= 65 && n <= 70) return n - 55; if (n >= 97 && n <= 102) return n - 87; return -1; }
function hexByte(s: string, i: number): number { return hexDigit(s[i]) * 16 + hexDigit(s[i + 1]); }
function validRGB(c: RGB): boolean { return !!c && Number.isInteger(c.r) && Number.isInteger(c.g) && Number.isInteger(c.b) && c.r >= 0 && c.r <= 255 && c.g >= 0 && c.g <= 255 && c.b >= 0 && c.b <= 255; }
export function toHex(c: RGB): string { if (!validRGB(c)) return ''; return '#'+[c.r,c.g,c.b].map(n => n.toString(16).padStart(2,'0').toUpperCase()).join(''); }
export function toRgb(c: RGB): string { return validRGB(c) ? `rgb(${c.r}, ${c.g}, ${c.b})` : ''; }
export type HSL = { h: number; s: number; l: number };
function rounded(n: number): number { return Math.floor(n + 0.5); }
export function toHsl(c: RGB): HSL {
  if (!validRGB(c)) return { h: 0, s: 0, l: 0 };
  const r=c.r/255, g=c.g/255, b=c.b/255, max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0; const l=(max+min)/2; let s=0;
  if (d !== 0) { s=d/(1-Math.abs(2*l-1)); if (max===r) h=60*(((g-b)/d)%6); else if (max===g) h=60*((b-r)/d+2); else h=60*((r-g)/d+4); if (h<0) h+=360; }
  return { h: rounded(h) % 360, s: rounded(s*100), l: rounded(l*100) };
}
export function fromHsl(hsl: HSL): RGB {
  if (!hsl || !Number.isFinite(hsl.h) || !Number.isFinite(hsl.s) || !Number.isFinite(hsl.l)) return { r: 0, g: 0, b: 0 };
  const h=((hsl.h%360)+360)%360, s=Math.max(0,Math.min(100,hsl.s))/100, l=Math.max(0,Math.min(100,hsl.l))/100;
  const chroma=(1-Math.abs(2*l-1))*s, x=chroma*(1-Math.abs((h/60)%2-1)), m=l-chroma/2;
  let r=0,g=0,b=0;
  if (h<60) { r=chroma; g=x; } else if (h<120) { r=x; g=chroma; } else if (h<180) { g=chroma; b=x; } else if (h<240) { g=x; b=chroma; } else if (h<300) { r=x; b=chroma; } else { r=chroma; b=x; }
  return { r: rounded((r+m)*255), g: rounded((g+m)*255), b: rounded((b+m)*255) };
}
function nameGroups(): Map<string,string[]> {
  const groups=new Map<string,string[]>();
  for (const name of Object.keys(CSS_NAMES).sort()) { const hex=CSS_NAMES[name]; const list=groups.get(hex) ?? []; list.push(name); groups.set(hex,list); }
  return groups;
}
const BY_HEX=nameGroups();
export function nameOf(c: RGB): NameResult {
  if (!validRGB(c)) return { name: 'unknown', exact: false, aliases: [] };
  const hex=toHex(c).slice(1), exact=BY_HEX.get(hex);
  if (exact) return { name: exact[0], exact: true, aliases: exact.slice(1) };
  let best='black', bestDistance=Infinity;
  for (const name of Object.keys(CSS_NAMES).sort()) { const value=CSS_NAMES[name]; const r=hexByte(value,0),g=hexByte(value,2),b=hexByte(value,4); const distance=(c.r-r)**2+(c.g-g)**2+(c.b-b)**2; if (distance<bestDistance) { bestDistance=distance; best=name; } }
  return { name: best, exact: false, aliases: BY_HEX.get(CSS_NAMES[best])?.slice(1) ?? [] };
}
export function describeColour(c: RGB): ColourDescription {
  const named=nameOf(c), hsl=toHsl(c);
  return { hex: toHex(c), rgb: toRgb(c), hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, name: named.name, exact: named.exact, aliases: named.aliases };
}
export function formatColour(d: ColourDescription): string { return `${d.exact ? '' : 'nearest '}${d.name} ${d.hex} (rgb ${d.rgb.slice(4, -1)}; hsl ${d.hsl.slice(4, -1)})`; }
function linear(channel: number): number { const v=channel/255; return v<=0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4; }
export function contrastRatio(a: RGB, b: RGB): number {
  if (!validRGB(a) || !validRGB(b)) return 0;
  const lum=(c:RGB)=>0.2126*linear(c.r)+0.7152*linear(c.g)+0.0722*linear(c.b);
  const x=lum(a),y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
export function readableOn(background: RGB): 'black' | 'white' { return contrastRatio({r:0,g:0,b:0},background) >= contrastRatio({r:255,g:255,b:255},background) ? 'black' : 'white'; }
export const CSS_COLOUR_NAME_COUNT = Object.keys(CSS_NAMES).length;
