import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EnvironmentIntelligence, analyzeProject } from '../dist/index.js';
import { MultiFileProjectBundler, typeCheckTypeScriptProject } from '../dist/runtime/projectBundler.js';

const root = process.cwd();
class MemoryProject {
  constructor(files) { this.files = new Map(Object.entries(files)); }
  async listFiles() { return [...this.files.keys()].sort(); }
  async readText(_projectId, file) { return this.files.get(file) ?? null; }
  async listFilesForAnalysis() { return [...this.files.entries()].map(([file, source]) => ({ path: file, source, sizeBytes: Buffer.byteLength(source), kind: 'text' })); }
  async listFilesForAnalyzer() { return [...this.files.entries()].map(([file, source]) => ({ path: file, sizeBytes: Buffer.byteLength(source), kind: 'text' })); }
  async readTextFile(file, maxBytes) { const value = this.files.get(file); return value === undefined || Buffer.byteLength(value) > maxBytes ? null : value; }
}
async function readTree(directory, relative = '') {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) Object.assign(result, await readTree(full, rel));
    else if (entry.isFile()) result[rel] = await readFile(full, 'utf8');
  }
  return result;
}
const fixturesRoot = path.join(root, 'tests/fixtures/round10');
const websiteFiles = await readTree(path.join(fixturesRoot, 'website'));
const aiFiles = await readTree(path.join(fixturesRoot, 'ai-tool'));
const gameFiles = await readTree(path.join(fixturesRoot, 'game'));

const website = new MemoryProject(websiteFiles);
const websiteAnalysis = await analyzeProject('R10 e-commerce website', {
  async listFiles() { return [...website.files.entries()].map(([file, source]) => ({ path: file, sizeBytes: Buffer.byteLength(source), kind: 'text' })); },
  async readTextFile(file) { return website.files.get(file) ?? null; }
});
const websiteProfile = new EnvironmentIntelligence().inspect('r10-website', Object.entries(websiteFiles).map(([file, content]) => ({ path: file, content })));
const websiteTypecheck = await typeCheckTypeScriptProject(website, 'r10-website');
const websiteBundle = await new MultiFileProjectBundler(website).bundle('r10-website', 'src/main.ts');
if (!websiteBundle.complete || !websiteTypecheck.success) throw new Error('R10 website project failed bundle/type-check preparation.');

const ai = new MemoryProject(aiFiles);
const aiTypecheck = await typeCheckTypeScriptProject(ai, 'r10-ai-tool');
const aiBundle = await new MultiFileProjectBundler(ai).bundle('r10-ai-tool', 'src/main.ts');
if (!aiBundle.complete || !aiTypecheck.success) throw new Error('R10 deterministic AI-tool fixture failed bundle/type-check preparation.');

const selfhostSource = {
  'src/pathSafety.ts': await readFile(path.join(root, 'src/pathSafety.ts'), 'utf8'),
  'src/lexer.ts': await readFile(path.join(root, 'src/lexer.ts'), 'utf8'),
  'src/diagnostics.ts': await readFile(path.join(root, 'src/diagnostics.ts'), 'utf8'),
  'src/types.ts': await readFile(path.join(root, 'src/types.ts'), 'utf8'),
  'src/lexer.js': await readFile(path.join(root, 'dist/lexer.js'), 'utf8'),
  'src/types.js': await readFile(path.join(root, 'dist/types.js'), 'utf8'),
  'tests/round10-selfhost/main.ts': `import { normalizeProjectPath } from '../../src/pathSafety';\nimport { tokenize } from '../../src/lexer';\nconst path = normalizeProjectPath('src/main.ts');\nconst scan = tokenize('const sample = 7;');\nconsole.log('R10_SELF_HOST', path, scan.tokens.length, scan.issues.length);\n`
};
const selfhost = new MemoryProject(selfhostSource);
const selfhostAnalysis = await analyzeProject('AXON Code self-host subset', {
  async listFiles() { return [...selfhost.files.entries()].map(([file, source]) => ({ path: file, sizeBytes: Buffer.byteLength(source), kind: 'text' })); },
  async readTextFile(file) { return selfhost.files.get(file) ?? null; }
});
const selfhostBundle = await new MultiFileProjectBundler(selfhost).bundle('r10-selfhost', 'tests/round10-selfhost/main.ts');
if (!selfhostBundle.complete) throw new Error('AXON Code self-host subset did not bundle.');

const wholeSourceFiles = await readTree(path.join(root, 'src'));
const wholeProject = new MemoryProject(Object.fromEntries(Object.entries(wholeSourceFiles).map(([file, source]) => [`src/${file}`, source])));
const fullTypecheck = await typeCheckTypeScriptProject(wholeProject, 'axon-code-self-host-full-source');
const fullAnalysis = await analyzeProject('AXON Code v0.8 source', {
  async listFiles() { return [...wholeProject.files.entries()].map(([file, source]) => ({ path: file, sizeBytes: Buffer.byteLength(source), kind: 'text' })); },
  async readTextFile(file) { return wholeProject.files.get(file) ?? null; }
});

const result = {
  website: { bundle: websiteBundle, typecheck: websiteTypecheck, analysis: websiteAnalysis, environment: websiteProfile, html: websiteFiles['index.html'], css: websiteFiles['site.css'], javascript: websiteFiles['site.js'] },
  aiTool: { bundle: aiBundle, typecheck: aiTypecheck },
  game: { files: gameFiles },
  selfhost: { bundle: selfhostBundle, analysis: selfhostAnalysis },
  fullSource: { fileCount: Object.keys(wholeSourceFiles).length, typecheck: fullTypecheck, analysis: { fileCount: fullAnalysis.outline.files, inspectedFiles: fullAnalysis.outline.inspectedFiles, languages: fullAnalysis.outline.languages, entryPoints: fullAnalysis.outline.entryPoints, diagnostics: fullAnalysis.diagnostics.length, diagnosticCodes: fullAnalysis.diagnostics.reduce((acc, item) => { acc[item.code] = (acc[item.code] ?? 0) + 1; return acc; }, {}) } }
};
await writeFile(path.join(root, 'tests/round10-browser-fixtures.json'), JSON.stringify(result), 'utf8');
console.log(JSON.stringify({
  website: { complete: result.website.bundle.complete, typecheck: result.website.typecheck.success, profile: result.website.environment.ecosystems, bundleSource: result.website.bundle.source },
  aiTool: { complete: result.aiTool.bundle.complete, typecheck: result.aiTool.typecheck.success, bundleSource: result.aiTool.bundle.source },
  game: { files: result.game.files },
  selfhost: { complete: result.selfhost.bundle.complete, includedFiles: result.selfhost.bundle.includedFiles, bundleSource: result.selfhost.bundle.source },
  fullSource: result.fullSource
}));
