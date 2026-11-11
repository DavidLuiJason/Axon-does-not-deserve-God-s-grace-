/** Runs independent observation sources under one session and one sequence stream. */
export function createCompositeCaptureAdapter(entries = []) {
  const sources = entries.map((entry) => entry?.adapter ? entry : { adapter: entry, required: true });
  if (!sources.length || sources.some((entry) => !entry.adapter?.start || !entry.adapter?.stop)) {
    throw new TypeError('Composite capture requires at least one valid adapter.');
  }
  let started = [];
  return {
    source: 'axon-interface',
    async getCapabilities() {
      const groups = await Promise.all(sources.map(async ({ adapter, required }) => ({
        source: adapter.source ?? 'unknown',
        required,
        capabilities: await adapter.getCapabilities?.() ?? [],
      })));
      return groups;
    },
    async start({ sessionId, options = {}, onEvent }) {
      started = [];
      const results = [];
      for (const { adapter, required } of sources) {
        try {
          const result = await adapter.start({ sessionId, options, onEvent });
          started.push(adapter);
          results.push({ source: adapter.source ?? 'unknown', started: true, result: result ?? null });
        } catch (error) {
          results.push({ source: adapter.source ?? 'unknown', started: false, reason: error.message });
          if (required) {
            await this.stop({ reason: 'required-source-failed' });
            throw error;
          }
        }
      }
      return { granted: true, sources: results };
    },
    async stop({ reason = 'user-stop' } = {}) {
      const results = [];
      for (const adapter of [...started].reverse()) {
        try { results.push({ source: adapter.source ?? 'unknown', ...(await adapter.stop({ reason })) }); }
        catch (error) { results.push({ source: adapter.source ?? 'unknown', stopped: false, reason: error.message }); }
      }
      started = [];
      return { stopped: results.every((result) => result.stopped !== false), sources: results };
    },
  };
}
