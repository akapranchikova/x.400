const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIR_SIGNATURE = 0x02014b50;
const ZIP_END_CENTRAL_DIR_SIGNATURE = 0x06054b50;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const createCrcTable = () => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
};

const crcTable = createCrcTable();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const index = (crc ^ data[i]) & 0xff;
    crc = (crc >>> 8) ^ crcTable[index];
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const toUint8Array = (input: string | Uint8Array | ArrayBuffer): Uint8Array => {
  if (typeof input === 'string') {
    return textEncoder.encode(input);
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  return new Uint8Array(input);
};

const clampYear = (year: number) => {
  if (!Number.isFinite(year) || year < 1980) {
    return 1980;
  }
  if (year > 2107) {
    return 2107;
  }
  return year;
};

const toDosDateTime = (date: Date) => {
  const year = clampYear(date.getUTCFullYear());
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);

  return {
    dosDate: ((year - 1980) << 9) | (month << 5) | day,
    dosTime: (hours << 11) | (minutes << 5) | seconds,
  };
};

interface ZipEntryRecord {
  name: string;
  data: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  dosDate: number;
  dosTime: number;
}

const concatBuffers = (segments: Uint8Array[]) => {
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const segment of segments) {
    combined.set(segment, offset);
    offset += segment.length;
  }
  return combined;
};

export class ZipBuilder {
  private entries: ZipEntryRecord[] = [];

  file(name: string, content: string | Uint8Array | ArrayBuffer) {
    const data = toUint8Array(content);
    const { dosDate, dosTime } = toDosDateTime(new Date());
    this.entries.push({
      name,
      data,
      crc: crc32(data),
      size: data.length,
      offset: 0,
      dosDate,
      dosTime,
    });
    return this;
  }

  private buildLocalSegments() {
    const parts: Uint8Array[] = [];
    let offset = 0;
    for (const entry of this.entries) {
      entry.offset = offset;
      const nameBytes = textEncoder.encode(entry.name);
      const header = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, ZIP_LOCAL_FILE_HEADER_SIGNATURE, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, entry.dosTime, true);
      view.setUint16(12, entry.dosDate, true);
      view.setUint32(14, entry.crc, true);
      view.setUint32(18, entry.size, true);
      view.setUint32(22, entry.size, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      header.set(nameBytes, 30);
      parts.push(header, entry.data);
      offset += header.length + entry.data.length;
    }
    return parts;
  }

  private buildCentralDirectory() {
    const parts: Uint8Array[] = [];
    for (const entry of this.entries) {
      const nameBytes = textEncoder.encode(entry.name);
      const header = new Uint8Array(46 + nameBytes.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, ZIP_CENTRAL_DIR_SIGNATURE, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, entry.dosTime, true);
      view.setUint16(14, entry.dosDate, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.size, true);
      view.setUint32(24, entry.size, true);
      view.setUint16(28, nameBytes.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, entry.offset, true);
      header.set(nameBytes, 46);
      parts.push(header);
    }
    return parts;
  }

  private buildEndRecord(centralDirectorySize: number, centralDirectoryOffset: number) {
    const record = new Uint8Array(22);
    const view = new DataView(record.buffer);
    view.setUint32(0, ZIP_END_CENTRAL_DIR_SIGNATURE, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, this.entries.length, true);
    view.setUint16(10, this.entries.length, true);
    view.setUint32(12, centralDirectorySize, true);
    view.setUint32(16, centralDirectoryOffset, true);
    view.setUint16(20, 0, true);
    return record;
  }

  private generate(): ArrayBuffer {
    const localSegment = concatBuffers(this.buildLocalSegments());
    const centralSegment = concatBuffers(this.buildCentralDirectory());
    const endRecord = this.buildEndRecord(centralSegment.length, localSegment.length);
    const archive = concatBuffers([localSegment, centralSegment, endRecord]);
    return archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength);
  }

  async generateAsync(options: { type?: 'arraybuffer' | 'uint8array' } = { type: 'arraybuffer' }) {
    const archive = this.generate();
    if (options.type === 'uint8array') {
      return new Uint8Array(archive);
    }
    return archive;
  }
}

export type ZipEntries = Map<string, Uint8Array>;

export const parseStoredZip = (input: ArrayBuffer | Uint8Array): ZipEntries => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: ZipEntries = new Map();
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature === ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
      const compression = view.getUint16(offset + 8, true);
      if (compression !== 0) {
        throw new Error('Unsupported compression method in zip entry');
      }
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const uncompressedSize = view.getUint32(offset + 22, true);
      const expectedCrc = view.getUint32(offset + 14, true);

      const nameStart = offset + 30;
      const nameEnd = nameStart + nameLength;
      const dataStart = nameEnd + extraLength;
      const dataEnd = dataStart + compressedSize;

      if (dataEnd > bytes.length) {
        throw new Error('Truncated zip entry data');
      }

      const name = textDecoder.decode(bytes.slice(nameStart, nameEnd));
      const payload = bytes.slice(dataStart, dataEnd);

      if (payload.length !== uncompressedSize) {
        throw new Error(`Zip entry size mismatch for ${name}`);
      }

      const actualCrc = crc32(payload);
      if (actualCrc !== expectedCrc) {
        throw new Error(`CRC mismatch for zip entry ${name}`);
      }

      entries.set(name, payload);
      offset = dataEnd;
      continue;
    }

    if (signature === ZIP_CENTRAL_DIR_SIGNATURE || signature === ZIP_END_CENTRAL_DIR_SIGNATURE) {
      break;
    }

    offset += 1;
  }

  return entries;
};

export const readZipText = (entries: ZipEntries, name: string): string | null => {
  const payload = entries.get(name);
  return payload ? textDecoder.decode(payload) : null;
};

export const readZipJson = <T>(entries: ZipEntries, name: string): T | null => {
  const text = readZipText(entries, name);
  if (text == null) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${name}: ${(error as Error).message}`);
  }
};
