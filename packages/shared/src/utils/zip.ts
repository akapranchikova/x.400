const textEncoder = new TextEncoder();

export type ZipInput = string | ArrayBuffer | ArrayBufferView;

type ZipEntry = {
  name: string;
  data: Uint8Array;
  crc32: number;
  modTime: number;
  modDate: number;
  offset: number;
};

const toUint8Array = (input: ZipInput): Uint8Array => {
  if (typeof input === 'string') {
    return textEncoder.encode(input);
  }

  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }

  throw new TypeError('Unsupported input type for zip entry');
};

const makeCrcTable = () => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      if ((crc & 1) !== 0) {
        crc = 0xedb88320 ^ (crc >>> 1);
      } else {
        crc >>>= 1;
      }
    }
    table[i] = crc >>> 0;
  }
  return table;
};

const CRC_TABLE = makeCrcTable();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i];
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const toDosTime = (date: Date) => {
  const year = date.getUTCFullYear();
  const safeYear = Math.max(1980, Math.min(year, 2107));
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((safeYear - 1980) << 9) | (month << 5) | day;

  return { time: dosTime & 0xffff, date: dosDate & 0xffff };
};

const writeLocalFileHeader = (entry: ZipEntry, nameBytes: Uint8Array): Uint8Array => {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true); // version needed to extract
  view.setUint16(6, 0, true); // general purpose bit flag
  view.setUint16(8, 0, true); // compression method (store)
  view.setUint16(10, entry.modTime, true);
  view.setUint16(12, entry.modDate, true);
  view.setUint32(14, entry.crc32, true);
  view.setUint32(18, entry.data.length, true);
  view.setUint32(22, entry.data.length, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true); // extra field length
  header.set(nameBytes, 30);
  return header;
};

const writeCentralDirectoryHeader = (entry: ZipEntry, nameBytes: Uint8Array): Uint8Array => {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 0x0314, true); // version made by (3.20)
  view.setUint16(6, 20, true); // version needed to extract
  view.setUint16(8, 0, true); // general purpose bit flag
  view.setUint16(10, 0, true); // compression method (store)
  view.setUint16(12, entry.modTime, true);
  view.setUint16(14, entry.modDate, true);
  view.setUint32(16, entry.crc32, true);
  view.setUint32(20, entry.data.length, true);
  view.setUint32(24, entry.data.length, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true); // extra field length
  view.setUint16(32, 0, true); // file comment length
  view.setUint16(34, 0, true); // disk number start
  view.setUint16(36, 0, true); // internal file attributes
  view.setUint32(38, 0, true); // external file attributes
  view.setUint32(42, entry.offset, true);
  header.set(nameBytes, 46);
  return header;
};

const writeEndOfCentralDirectory = (
  entryCount: number,
  centralSize: number,
  centralOffset: number,
): Uint8Array => {
  const footer = new Uint8Array(22);
  const view = new DataView(footer.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true); // number of this disk
  view.setUint16(6, 0, true); // disk where central directory starts
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true); // comment length
  return footer;
};

export class ZipBuilder {
  private readonly entries: ZipEntry[] = [];

  addFile(path: string, contents: ZipInput): this {
    const normalizedPath = path.replace(/\\+/g, '/');
    const name = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
    const data = toUint8Array(contents);
    const crc = crc32(data);
    const { time, date } = toDosTime(new Date());

    this.entries.push({ name, data, crc32: crc, modTime: time, modDate: date, offset: 0 });
    return this;
  }

  addJson(path: string, value: unknown): this {
    return this.addFile(path, JSON.stringify(value, null, 2));
  }

  build(): ArrayBuffer {
    let localSize = 0;
    const localChunks: Uint8Array[] = [];

    for (const entry of this.entries) {
      const nameBytes = textEncoder.encode(entry.name);
      const header = writeLocalFileHeader(entry, nameBytes);
      entry.offset = localSize;
      localChunks.push(header, entry.data);
      localSize += header.length + entry.data.length;
    }

    let centralSize = 0;
    const centralChunks: Uint8Array[] = [];

    for (const entry of this.entries) {
      const nameBytes = textEncoder.encode(entry.name);
      const header = writeCentralDirectoryHeader(entry, nameBytes);
      centralChunks.push(header);
      centralSize += header.length;
    }

    const footer = writeEndOfCentralDirectory(this.entries.length, centralSize, localSize);
    const totalSize = localSize + centralSize + footer.length;
    const output = new Uint8Array(totalSize);

    let offset = 0;
    for (const chunk of localChunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    for (const chunk of centralChunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    output.set(footer, offset);

    return output.buffer;
  }
}
