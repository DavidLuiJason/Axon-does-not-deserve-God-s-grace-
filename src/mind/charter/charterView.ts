import { validateCharter, defaultCharter, CHARTER_LIMITS } from './charter.ts';
import type { Charter, Sha256, CharterError } from './charter.ts';
import { verifyCharter } from './change.ts';

export const CHARTER_UNTRUSTED_NOTICE = 'Your Charter could not be checked, so I ask before every action.';
export type StoredCharterRead = { readonly kind:'absent' } | { readonly kind:'unreadable' } | { readonly kind:'text'; readonly text:string };
export type UntrustedReason = CharterError | 'unreadable' | 'not-json' | 'unsigned' | 'signature-mismatch';
export type CharterLoad =
  | { readonly status:'built-in'; readonly reason:'no-stored-charter'; readonly charter:Charter }
  | { readonly status:'signed'; readonly reason:'trusted'; readonly charter:Charter }
  | { readonly status:'untrusted'; readonly reason:UntrustedReason; readonly charter:null };
export type CharterLink = { readonly tool:string; readonly actions:readonly string[] };
export type CharterViewArgs = { readonly load:CharterLoad; readonly toolIds:readonly string[]; readonly links:readonly CharterLink[] };
export type CharterFeedView = { readonly never:readonly string[]; readonly ask:readonly string[]; readonly status:'built-in'|'signed'|'charter-untrusted'; readonly notice:string };

const object = (v:unknown):v is Record<PropertyKey, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v:object, keys:readonly string[]):boolean => {
  const own = Reflect.ownKeys(v);
  return own.length === keys.length && keys.every(k => own.includes(k));
};
const exactThreeKeys = (v:object,a:string,b:string,c:string):boolean => {
  const own = Reflect.ownKeys(v);
  return own.length === 3 && own.includes(a) && own.includes(b) && own.includes(c);
};
const untrusted = (reason:UntrustedReason):CharterLoad => Object.freeze({status:'untrusted',reason,charter:null});
const builtin = ():CharterLoad => Object.freeze({status:'built-in',reason:'no-stored-charter',charter:defaultCharter()});
const signed = (charter:Charter):CharterLoad => Object.freeze({status:'signed',reason:'trusted',charter});
const failureMessage = 'Charter view input is invalid.';
const fail = (error:'bad-input'|'unknown-key'|'bad-load'|'bad-tool-ids'|'bad-links'|'unknown-link-tool') =>
  Object.freeze({ok:false as const,error,message:failureMessage});
const ruleOf = (actions:Record<string,{level:string}>, id:string) => Object.prototype.hasOwnProperty.call(actions,id) ? actions[id] : undefined;
const distinctStrings = (v:unknown):v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string' && x.length > 0) && new Set(v).size === v.length;

export function loadCharterText(stored:StoredCharterRead, sha256:Sha256):CharterLoad {
  try {
    if (typeof sha256 !== 'function' || !object(stored)) return untrusted('unreadable');
    if (stored.kind === 'absent' && exactKeys(stored,['kind'])) return builtin();
    if (stored.kind === 'text' && exactKeys(stored,['kind','text']) && typeof stored.text === 'string') {
      if (stored.text.length > CHARTER_LIMITS.inputCharacters) return untrusted('input-too-large');
      let parsed:unknown;
      try { parsed = JSON.parse(stored.text); } catch { return untrusted('not-json'); }
      const checked = validateCharter(parsed);
      if (!checked.ok) return untrusted(checked.error);
      const verified = verifyCharter(checked.value,sha256);
      if (!verified.ok) return untrusted(verified.reason === 'unsigned' ? 'unsigned' : 'signature-mismatch');
      return signed(checked.value);
    }
    return untrusted('unreadable');
  } catch { return untrusted('unreadable'); }
}

export function serializeCharter(charter:unknown):{ok:true;text:string}|{ok:false;error:CharterError;message:string} {
  try {
    const checked = validateCharter(charter);
    if (!checked.ok) return Object.freeze({ok:false as const,error:checked.error,message:checked.message});
    const text = JSON.stringify(checked.value,(_key,value) => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
      const sorted:Record<string,unknown> = {};
      for (const key of Object.keys(value).sort()) Object.defineProperty(sorted,key,{value:value[key],enumerable:true,writable:true,configurable:true});
      return sorted;
    });
    return Object.freeze({ok:true as const,text});
  } catch {
    return Object.freeze({ok:false as const,error:'circular-input' as const,message:'Charter could not be safely inspected.'});
  }
}

export function charterToFeedView(args:CharterViewArgs):{ok:true;value:CharterFeedView}|{ok:false;error:'bad-input'|'unknown-key'|'bad-load'|'bad-tool-ids'|'bad-links'|'unknown-link-tool';message:string} {
  try {
    if (!object(args)) return fail('bad-input');
    if (!exactThreeKeys(args,'load','toolIds','links')) return fail('unknown-key');
    const load = args.load;
    if (!object(load)) return fail('bad-load');
    const shape = load.status === 'built-in'
      ? exactThreeKeys(load,'status','reason','charter') && load.reason === 'no-stored-charter'
      : load.status === 'signed'
        ? exactThreeKeys(load,'status','reason','charter') && load.reason === 'trusted'
        : load.status === 'untrusted'
          ? exactThreeKeys(load,'status','reason','charter') && typeof load.reason === 'string' && load.reason.length > 0 && load.charter === null
          : false;
    if (!shape) return fail('bad-load');
    if (!distinctStrings(args.toolIds)) return fail('bad-tool-ids');
    if (!Array.isArray(args.links)) return fail('bad-links');
    const seenTools = new Set<string>();
    for (const link of args.links) {
      if (!object(link) || !exactKeys(link,['tool','actions']) || typeof link.tool !== 'string' || link.tool.length === 0 || !distinctStrings(link.actions)) return fail('bad-links');
      if (seenTools.has(link.tool)) return fail('bad-links');
      seenTools.add(link.tool);
    }
    for (const link of args.links) if (!args.toolIds.includes(link.tool)) return fail('unknown-link-tool');

    const makeValue = (never:string[],ask:string[],status:CharterFeedView['status'],notice:string):CharterFeedView =>
      Object.freeze({never:Object.freeze(never),ask:Object.freeze(ask),status,notice});
    if (load.status === 'untrusted') {
      return Object.freeze({ok:true as const,value:makeValue([],Array.from(args.toolIds),'charter-untrusted',CHARTER_UNTRUSTED_NOTICE)});
    }
    const checked = validateCharter(load.charter);
    if (!checked.ok) return Object.freeze({ok:true as const,value:makeValue([],Array.from(args.toolIds),'charter-untrusted',CHARTER_UNTRUSTED_NOTICE)});
    const never:string[] = [];
    const ask:string[] = [];
    for (const tool of args.toolIds) {
      let strict = 2;
      const direct = `tools.${tool}`;
      let directFound = false;
      for (const lane of Object.values(checked.value.lanes)) {
        const rule = ruleOf(lane.actions,direct);
        if (rule) {
          directFound = true;
          const level = rule.level === 'never' ? 0 : rule.level === 'ask' ? 1 : 2;
          if (level < strict) strict = level;
        }
      }
      const link = args.links.find(item => item.tool === tool);
      if (link) for (const action of link.actions) {
        let found = false;
        for (const lane of Object.values(checked.value.lanes)) {
          const rule = ruleOf(lane.actions,action);
          if (rule) {
            found = true;
            const level = rule.level === 'never' ? 0 : rule.level === 'ask' ? 1 : 2;
            if (level < strict) strict = level;
          }
        }
        if (!found && strict > 1) strict = 1;
      }
      if (directFound && strict === 2) { /* allowed is intentionally non-restrictive */ }
      if (strict === 0) never.push(tool);
      else if (strict === 1) ask.push(tool);
    }
    return Object.freeze({ok:true as const,value:makeValue(never,ask,load.status,'')});
  } catch { return fail('bad-input'); }
}
