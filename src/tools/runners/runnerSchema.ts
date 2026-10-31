/**
 * The ONE door from the runners to the brain (FL12 boundary, Director PROPOSAL 2026-10-31; the owner confirms the entry in
 * `tests/brainBoundary.test.ts`). Runners only READ the tool schemas (pure, frozen data) to check their typed arguments; they never
 * reach the chat pipeline. Every runner imports `getSchema` from here, so the boundary test lists exactly one file.
 */
export { getSchema } from '../../brain/mind/schema/actionSchemas';
