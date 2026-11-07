/**
 * CONNECT1-B proposed action. Not registered; the Director registers it with the chat action and switch.
 */
import type { ActionDef } from '../kernel/types';
import { makeQr, type QrLevel } from './engines/create/qrCode';
export const QR_ACTION: ActionDef = {
  id: 'create.qr', capabilityId: 'creation-tools', // DIRECTOR TO CONFIRM: follows the accepted batch-one creation capability.
  label: 'Make QR code', executionClass: 'instant',
  inputFields: [
    { name: 'text', type: 'string', required: true, prompt: 'What text or link should the QR code contain?' },
    { name: 'level', type: 'string', required: true, prompt: 'Choose error correction level L, M, Q or H.' }
  ],
  outputFields: [{ name: 'size', type: 'number' }, { name: 'modules', type: 'string' }], resources: {}, cancel: 'none',
  evidence: 'The QR engine generated a standards-based QR module matrix from the supplied text.',
  run: async input => { const r = makeQr(String(input.text), { level: String(input.level) as QrLevel }); if (!r.ok) throw new Error('QR Maker refused: ' + r.error); return { size: r.size, modules: JSON.stringify(r.modules), level: r.level }; }
};
