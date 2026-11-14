const REQUIRED_HANDOVER_SECTIONS = [
  'What is proven',
  'What is not proven',
  'Capability registry counts',
  'Next device verification',
];

export function verifyRound15Handover({ handover, checklist, registry } = {}) {
  if (typeof handover !== 'string' || typeof checklist !== 'string') throw new Error('HANDOVER_DOCUMENTS_REQUIRED');
  if (!registry || !Array.isArray(registry.capabilities)) throw new Error('CAPABILITY_REGISTRY_REQUIRED');
  for (const section of REQUIRED_HANDOVER_SECTIONS) {
    if (!handover.includes(section)) throw new Error(`HANDOVER_SECTION_MISSING:${section}`);
  }
  if (!/Android device[^\n]*NOT RUN/i.test(handover)) throw new Error('ANDROID_DEVICE_STATUS_MUST_BE_NOT_RUN');
  if (!/competitor trials?[^\n]*NOT RUN/i.test(handover)) throw new Error('COMPETITOR_STATUS_MUST_BE_NOT_RUN');
  if (/AXON Code\s+(?:beats|outperforms|is superior to)\s+(?:Termux|Pydroid|Acode)/i.test(handover)) {
    throw new Error('UNSUPPORTED_COMPETITOR_SUPERIORITY_CLAIM');
  }
  if (!/\[ \] PASS[\s\S]*\[ \] FAIL/.test(checklist)) throw new Error('CHECKLIST_PASS_FAIL_FIELDS_MISSING');
  for (const product of ['Termux', 'Pydroid 3', 'Acode']) {
    if (!checklist.includes(product)) throw new Error(`COMPETITOR_CHECKLIST_MISSING:${product}`);
  }
  const statuses = ['TESTED', 'BUILT', 'BLOCKED', 'NOT IMPLEMENTED', 'NOT RUN'];
  const counts = Object.fromEntries(statuses.map((status) => [
    status,
    registry.capabilities.filter((row) => row.status === status).length,
  ]));
  if (!handover.includes(`**${registry.capabilities.length} capabilities**`)) {
    throw new Error('HANDOVER_REGISTRY_COUNT_MISMATCH');
  }
  for (const status of statuses) {
    const escaped = status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = new RegExp(`\\| ${escaped} \\| ${counts[status]} \\|`);
    if (!row.test(handover)) throw new Error(`HANDOVER_REGISTRY_STATUS_COUNT_MISMATCH:${status}`);
  }
  return { valid: true, capabilityCount: registry.capabilities.length, counts };
}
