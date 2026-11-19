/** Director 471 (ROUND-ALL): real-brain proof for the Calculator. Quoted expressions with evaluate/compute only; unquoted arithmetic stays with the old path (reported). */
import { runLiveProof, type ProofReply } from './helpers/liveProof';
const says = (value: string) => (reply: ProofReply): string | null => (reply.content.includes(`The answer is ${value}.\n`) ? null : `expected "The answer is ${value}." in ${reply.content.slice(0, 120)}`);
await runLiveProof({
  name: 'liveBrainCalculator', toolId: 'calculator',
  answers: [
    ['evaluate "2+2"', says('4')], ['compute "(3+4)*5"', says('35')], ['evaluate "2^10"', says('1024')], ['evaluate "100/8"', says('12.5')], ['evaluate "10-3"', says('7')],
    ['evaluate "3*3*3"', says('27')], ['evaluate "1/4"', says('0.25')], ['evaluate "0.1+0.2"', says('0.3')], ['evaluate "5!"', says('120')],
    ['evaluate "sin(90)" in degrees', says('1')], ['evaluate "cos(0)" using degrees', says('1')], ['evaluate "2*(3+4)"', says('14')], ['evaluate "1000*1.05"', says('1050')],
    ['evaluate "-5+10"', says('5')], ['evaluate "(2+3)^2"', says('25')], ['compute "9/3"', says('3')], ['evaluate "123456789*1000"', says('123456789000')],
    ['evaluate "12345679*9"', says('111111111')], ['evaluate "0.5*0.5"', says('0.25')], ['evaluate "3+4*2"', says('11')], ['please evaluate "6*7"', says('42')], ['Compute "8*8"', says('64')],
    ['evaluate "cos(0)" in radians', says('1')],
  ],
  mustNot: [
    'how do I evaluate "2+2"', 'evaluate "2+2" and "3+3"', 'evaluate "2+"', 'evaluate "10/0"', 'evaluate my options', 'evaluate "hello"', 'evaluate "call 555+1234"', 'compute "2024-01-15"',
    'what is "2+2"', 'do not evaluate "2+2"', 'never compute "3*3"', 'evaluate "2+2" in python', 'evaluate "2+2"; also hash "abc"', 'evaluate "2+2" in french', 'evaluate "sin(90)" in gradians',
    'evaluate "salary*12"', 'compute the probability "1/6"', 'evaluate the odds "1/2"', 'evaluate "2+2" for my taxes', 'evaluate "2+2" in degrees and radians', 'evaluate "10-2-3"',
    'evaluate the situation', 'calculate my mortgage', 'compute "1+1" and send it to my boss', 'evaluate "' + '1+'.repeat(400) + '1"',
  ],
  others: ['hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42', 'sort the lines "b\na"', 'count words in "one two three"', 'create QR code containing "hello"', 'encode "hello" as base64', 'replace "cat" with "fox" in "the cat sat"', 'hash "abc" with sha-256'],
});
