/** Menu, engine descriptors and registry actions must remain in agreement. */
import { CATALOG_TOOLS } from '../src/tools/toolCatalog';
import { ENGINE_DESCRIPTORS, registerEngineTools } from '../src/capabilities/registerEngineTools';
import { registerAxonToolsCapability } from '../src/capabilities/registerAxonTools';
import { registerInterfaceCaptureCapability } from '../src/capabilities/registerInterfaceCapture';
import { registerBackgroundProofCapability } from '../src/capabilities/registerBackgroundProof';
import { registerDictionaryCapability } from '../src/capabilities/registerDictionary';
import { listCapabilities, listChatActions, getCapability } from '../src/capabilities/registry';

let checks = 0;
function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function main(): void {
  registerAxonToolsCapability();
  registerInterfaceCaptureCapability();
  registerBackgroundProofCapability();
  registerDictionaryCapability();
  registerEngineTools();

  const catalogIds = new Set(CATALOG_TOOLS.map((tool) => tool.id));
  const descriptors = ENGINE_DESCRIPTORS as readonly { toolId: string; purpose: string; examples: readonly string[] }[];
  for (const descriptor of descriptors) {
    assert(descriptor.toolId === 'converter' || catalogIds.has(descriptor.toolId), `descriptor id is catalogued: ${descriptor.toolId}`);
    assert(descriptor.purpose.trim().length > 0, `descriptor purpose is non-empty: ${descriptor.toolId}`);
    assert(descriptor.examples.length >= 2, `descriptor has at least two examples: ${descriptor.toolId}`);
  }

  const actions = listChatActions();
  const engineActions = actions.filter(({ action }) => action.id.startsWith('act.engine.'));
  const descriptorIds = [...new Set(descriptors.map((descriptor) => descriptor.toolId))];
  for (const toolId of descriptorIds) {
    const matches = engineActions.filter(({ action }) => action.id === `act.engine.${toolId}`);
    assert(matches.length === 1, `descriptor tool family ${toolId} has exactly one chat action`);
    assert(matches[0]?.action.status === 'not-built', `engine action ${toolId} is not falsely available`);
    assert(matches[0]?.action.note === 'Opens from the Tools menu once its screen exists; chat control arrives with the brain.', `engine action ${toolId} has the required honest note`);
  }
  // Only actions whose own test files prove chat can run them may be 'available'; engine actions never are.
  const PROVEN_AVAILABLE = new Set(['act.text-counter', 'act.english-dictionary.lookup']);
  for (const { action } of actions) {
    assert(action.status !== 'available' || PROVEN_AVAILABLE.has(action.id), `only proven actions are available: ${action.id}`);
  }

  const available = CATALOG_TOOLS.filter((tool) => tool.status === 'available');
  const capabilities = listCapabilities();
  const registryEntryExists = (toolId: string): boolean => {
    if (toolId === 'text-counter') return actions.some(({ action }) => action.id === 'act.text-counter');
    if (toolId === 'interface-capture') return capabilities.some(({ id }) => id === 'cap.interface-capture');
    if (toolId === 'background-proof') return capabilities.some(({ id }) => id === 'cap.background-proof');
    if (toolId === 'dictionary') return capabilities.some(({ id }) => id === 'cap.english-dictionary');
    return getCapability(`cap.engine-tools.${toolId}`) !== undefined;
  };
  for (const tool of available) assert(registryEntryExists(tool.id), `available catalog tool has a registry entry: ${tool.id}`);

  assert(CATALOG_TOOLS.some((tool) => tool.id === 'file-compare' && tool.name === 'File Compare' && tool.description === 'Compare any two files and see how many differences there are and where.' && tool.groupId === 'files-convert' && tool.status === 'available'), 'File Compare has the exact requested catalog entry');
  console.log(`=== engine truth tests passed: ${checks} checks ===`);
}

main();
