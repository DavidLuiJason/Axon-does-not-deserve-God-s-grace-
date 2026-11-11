/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 4B — register AXON Tools as a real capability.
 * Declarative architecture only: no UI mount coupling, no behavior change
 * to AxonToolsScreen.tsx.
 */

import { registerCapability, getCapability } from './registry';
import type { ChatAction } from './types';
import { addOnlyList } from '../generated/mergeGenerated';
import { GENERATED_CHAT_ACTIONS } from '../generated/wiredChatActions';

const AXON_TOOLS_CAPABILITY = {
  id: 'cap.axon-tools',
  displayName: 'AXON Tools',
  contractVersion: '1.0.0',
  implementationVersion: '1.0.0',
  noChatAction: 'The child tool capabilities own their registered chat actions.',
} as const;

/**
 * Text Tools: the text actions that run on the execution kernel (Text Counter, Case Converter and Sort Lines).
 * Matches the kernel capability id "text-tools". Stores no user data.
 */
const TEXT_TOOLS_CAPABILITY = {
  id: 'cap.text-tools',
  displayName: 'Text Tools',
  contractVersion: '1.0.0',
  implementationVersion: '1.0.0',
  dataProvider: 'noUserData',
  chatActions: addOnlyList([{
    id: 'act.text-counter',
    purpose: 'Count text',
    examples: [
      'count words in hello brave new world',
      'how many characters are in good morning',
      'count lines',
    ],
    status: 'available',
    link: { commandId: 'text-count', actionId: 'text.count' },
  }, {
    id: 'act.case-converter',
    purpose: 'Convert the case of text',
    examples: [
      'convert "hello world" to uppercase',
      'make "Hello World" lowercase',
      'turn "my var name" into snake case',
    ],
    status: 'available',
    link: { actionId: 'text.case' },
  }, {
    id: 'act.sort-lines',
    purpose: 'Sort lines of text',
    examples: [
      'sort the lines "pear\napple\nfig"',
      'sort "b\na\nc" descending',
      'sort "ccc\na\nbb" by length',
    ],
    status: 'available',
    link: { actionId: 'text.sort' },
  }] as ChatAction[], GENERATED_CHAT_ACTIONS, (a) => a.id, 'chat action'),
} as const;

const CREATION_TOOLS_CAPABILITY = {
  id: 'cap.creation-tools',
  displayName: 'Creation Tools',
  contractVersion: '1.0.0',
  implementationVersion: '1.0.0',
  dataProvider: 'noUserData',
  chatActions: [{
    id: 'act.encoder-decoder', purpose: 'Encode or decode text', examples: ['encode \"hello\" as base64', 'decode \"aGVsbG8=\" from base64'], status: 'available', link: { actionId: 'create.encode' },
  }, { id: 'act.hash-tool', purpose: 'Calculate a hash or checksum', examples: ['calculate checksum of \"123456789\" using CRC32'], status: 'available', link: { actionId: 'create.hash' } }, { id: 'act.qr-maker', purpose: 'QR code maker', examples: ['create QR code containing \"https://example.com\"'], status: 'available', link: { actionId: 'create.qr' } }] as ChatAction[],
} as const;

const NUMBER_TOOLS_CAPABILITY = {
  id: 'cap.number-tools',
  displayName: 'Number Tools',
  contractVersion: '1.0.0',
  implementationVersion: '1.0.0',
  dataProvider: 'noUserData',
  chatActions: [{
    id: 'act.number-to-words',
    purpose: 'Spell out a number',
    examples: ['spell the number 12', 'spell out 42', 'spell 100'],
    status: 'available',
    link: { actionId: 'number.words' },
  }] as ChatAction[],
} as const;

/**
 * Register the AXON Tools capability, and the Text Tools capability that lives
 * inside it, at app startup.
 * Call once — not from AxonToolsScreen mount/unmount.
 */
export function registerAxonToolsCapability(): void {
  registerCapability({ ...AXON_TOOLS_CAPABILITY });
  registerCapability({ ...TEXT_TOOLS_CAPABILITY });
  registerCapability({ ...NUMBER_TOOLS_CAPABILITY });
  registerCapability({ ...CREATION_TOOLS_CAPABILITY });
  console.log(
    '[AXON capability registry] AXON Tools registered:',
    getCapability('cap.axon-tools')
  );
  console.log(
    '[AXON capability registry] Text Tools registered:',
    getCapability('cap.text-tools')
  );
  console.log('[AXON capability registry] Number Tools registered:', getCapability('cap.number-tools'));
  console.log('[AXON capability registry] Creation Tools registered:', getCapability('cap.creation-tools'));
}
