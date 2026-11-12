import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class NodeFileKeyValueHost {
  async read(filePath) {
    try { return await fs.readFile(filePath, 'utf8'); }
    catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
  }
  async writeAtomic(filePath, contents) {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(contents, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    if (process.env.AXON_FILE_STORE_FAILPOINT === 'kill-after-temp-sync') process.kill(process.pid, 'SIGKILL');
    await fs.rename(temporary, filePath);
    try { const dir = await fs.open(directory, 'r'); try { await dir.sync(); } finally { await dir.close(); } } catch { /* directory fsync is host/filesystem dependent */ }
  }
  async remove(filePath) {
    try { await fs.rm(filePath, { force: true }); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  async list(directory) {
    try { return await fs.readdir(directory); }
    catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
  }
}
