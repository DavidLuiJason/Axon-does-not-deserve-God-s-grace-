import fs from 'node:fs/promises';
import path from 'node:path';
import { serialize, deserialize } from 'node:v8';

/** Test-only durable store used to cross an actual Node process boundary. */
export class FileKvStore {
  constructor(root) { this.root = root; }
  async init() { await fs.mkdir(this.root, { recursive: true }); }
  file(key) { return path.join(this.root, `${Buffer.from(key).toString('base64url')}.bin`); }
  async get(key) {
    try { return deserialize(await fs.readFile(this.file(key))); }
    catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
  }
  async put(key, value) {
    await this.init();
    const target = this.file(key);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    const handle = await fs.open(temp, 'wx', 0o600);
    try { await handle.writeFile(serialize(value)); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temp, target);
  }
  async mutate(key, updater) {
    const current = await this.get(key);
    const next = updater(current);
    await this.put(key, next);
    return next;
  }
  async delete(key) { await fs.rm(this.file(key), { force: true }); }
  async list(prefix) {
    await this.init();
    const entries = [];
    for (const name of await fs.readdir(this.root)) {
      if (!name.endsWith('.bin')) continue;
      const key = Buffer.from(name.slice(0, -4), 'base64url').toString();
      if (key.startsWith(prefix)) entries.push({ key, value: await this.get(key) });
    }
    return entries;
  }
}
