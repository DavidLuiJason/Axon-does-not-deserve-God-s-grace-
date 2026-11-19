/** Director 471 (ROUND-ALL): real-brain proof for the Percentage Helper through the new percentage SHAPER (src/brain/mind/bind/shapers.ts).
 * Covered shapes: "X% of Y" (percent-of) and "increase/decrease/add/take ... %" (adjust). "what percent ..." and "percent change ..." phrasings are not matched by the resolver: reported. */
import { runLiveProof, type ProofReply } from './helpers/liveProof';
const has = (text: string) => (reply: ProofReply): string | null => (reply.content.includes(text + '\n') ? null : `expected "${text}" in ${reply.content.slice(0, 120)}`);
const of = (p: string, y: string, r: string): readonly [string, (x: ProofReply) => string | null] => [`what is ${p}% of ${y}`, has(`${p} percent of ${y} is ${r}.`)];
const adj = (message: string, r: string): readonly [string, (x: ProofReply) => string | null] => [message, has(`The adjusted value is ${r}.`)];
await runLiveProof({
  name: 'liveBrainPercentage', toolId: 'percentage-helper',
  answers: [
    ['what is 15% of 80', has('15 percent of 80 is 12.')], ['what is 12 percent of 50', has('12 percent of 50 is 6.')], of('50', '200', '100'), of('100', '37', '37'),
    of('0', '5', '0'), of('250', '40', '100'), of('20', '150', '30'), of('33', '300', '99'), of('1', '1000', '10'), of('15', '0', '0'),
    adj('take 10% off 80', '72'), adj('take 25% off 200', '150'), adj('increase 200 by 15%', '230'), adj('decrease 200 by 15%', '170'), adj('add 15% to 200', '230'),
    adj('increase 80 by 50%', '120'), adj('decrease 1000 by 1%', '990'), adj('raise 40 by 25%', '50'), adj('reduce 60 by 50%', '30'),
  ],
  mustNot: [
    'how do I calculate 15% of 80', '15% of the time I am late', 'what is 15% of 80 and 20% of 90', 'what is 15% of my salary', 'what is 15% of 80 tax', 'tip 15% on 80', 'what is 15% of',
    'increase my rent by 15%', 'what percent is 20 of 80', 'percent change from 50 to 75', '15 is 30% of what', 'I am 100% sure', 'increase 200 by 15 percent compare 30%',
    'what is 15% of 80 in euros', 'do not take 10% off 80', 'what is 15% of 80%', 'what is 15% of 80 in python', 'increase 200 by 15% twice', 'what is 20% of 150 and then send it to my boss',
    'what is 15% of 80 ' + 'a '.repeat(300),
  ],
  others: ['hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42', 'sort the lines "b\na"', 'count words in "one two three"', 'create QR code containing "hello"', 'encode "hello" as base64', 'replace "cat" with "fox" in "the cat sat"', 'hash "abc" with sha-256'],
});
