export type ToneSignalKind = 'capitals'|'exclaim'|'question-run'|'stretched'|'repeat-word'|'urgent-word'|'anger-word'|'harsh-word';
export type ToneDoubt = 'negated'|'material-only'|'emphasis-only';
export interface ToneWordFacts { start:number; end:number; norm:string; urgent:0|1|2; anger:0|1|2; harsh:boolean; negation:boolean; aboutAxon:boolean; material:boolean; }
export interface ToneSignal { kind:ToneSignalKind; start:number; end:number; text:string; weight:1|2; }
export interface MaterialRange { start:number; end:number; }
export interface ToneReading { urgency:0|1|2|3; frustration:0|1|2|3; emphasis:0|1|2|3; aimedAtAxon:true|null; answerStyle:'normal'|'brief'|'calm'; signals:ToneSignal[]; doubts:ToneDoubt[]; changesActions:false; }
export type ReadTone = (text:string, words:readonly ToneWordFacts[], materials:readonly MaterialRange[]) => ToneReading;
