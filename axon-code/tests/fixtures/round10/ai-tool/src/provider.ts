export interface TextProvider { readonly providerKind: string; complete(prompt: string): Promise<string>; }
export class DeterministicTestProvider implements TextProvider {
  readonly providerKind = 'TEST_DOUBLE';
  async complete(prompt: string): Promise<string> {
    const count = (prompt.match(/ERROR:/g) || []).length;
    return JSON.stringify({ summary: `${count} error marker(s) supplied`, nextStep: 'Inspect the first verified diagnostic.' });
  }
}
