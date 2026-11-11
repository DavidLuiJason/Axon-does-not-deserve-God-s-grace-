import { DeterministicTestProvider } from './provider';
export async function runDiagnosticHelper(messages: string[]) {
  const provider = new DeterministicTestProvider();
  const prompt = messages.join('\n');
  const response = await provider.complete(prompt);
  console.log('R10_AI_TOOL_SIMULATION', provider.providerKind, response);
  return { providerKind: provider.providerKind, response: JSON.parse(response) };
}
void runDiagnosticHelper(['ERROR: missing dependency', 'ERROR: invalid type']);
