import { deflateRawSync } from 'node:zlib';

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function makeZip(entries, options = {}) {
  const locals = [];
  const centrals = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const content = Buffer.from(entry.data ?? '', 'utf8');
    const method = entry.method ?? 0;
    const compressed = method === 8 ? deflateRawSync(content) : content;
    const actualCrc = crc32(content);
    const declaredCrc = entry.declaredCrc ?? actualCrc;
    const declaredUncompressed = entry.declaredUncompressed ?? content.length;
    const dataDescriptor = Boolean(entry.dataDescriptor);
    const flags = (entry.flags ?? 0) | (dataDescriptor ? 0x0008 : 0);
    const local = Buffer.alloc(30 + name.length + compressed.length + (dataDescriptor ? 16 : 0));
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(dataDescriptor ? 0 : declaredCrc, 14);
    local.writeUInt32LE(dataDescriptor ? 0 : compressed.length, 18);
    local.writeUInt32LE(dataDescriptor ? 0 : declaredUncompressed, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    compressed.copy(local, 30 + name.length);
    if (dataDescriptor) {
      const dd = 30 + name.length + compressed.length;
      local.writeUInt32LE(0x08074b50, dd);
      local.writeUInt32LE(declaredCrc, dd + 4);
      local.writeUInt32LE(compressed.length, dd + 8);
      local.writeUInt32LE(declaredUncompressed, dd + 12);
    }
    locals.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((entry.hostSystem ?? 3) << 8 | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(declaredCrc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(declaredUncompressed, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    const mode = entry.symlink ? 0xa1ff : entry.directory ? 0x41ed : 0x81a4;
    central.writeUInt32LE(((mode << 16) | (entry.directory ? 0x10 : 0)) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centrals.push(central);
    localOffset += local.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return new Uint8Array(Buffer.concat([...locals, centralBytes, eocd]));
}
