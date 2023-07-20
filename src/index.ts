import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { ProtocolSpec, ProtocolSpecData, ProtocolSpecRegularDataTypes, ProtocolSpecSpecialDataTypes, isValidProtocolSpec } from './Types';
import { capitalize, getNextChar, resetNextChar, typeMappings } from './utils';

// TODO: Directories

// TODO: Make "bytes" type require a length
// TODO: Fix issues with "data" key

export default async function autobuf(spec: ProtocolSpec, output: string) {
  // Verification
  if (!isValidProtocolSpec(spec)) throw new Error('Protocol Spec must be a valid JSON Protocol Spec File');

  // Setup Output Dir
  await rm(output, {
    force: true,
    recursive: true,
  });
  await mkdir(output, {
    recursive: true,
  });

  // Stores file data
  const files = {
    'BufWrapper.ts': `// Credit to MinecraftJS (https://github.com/MinecraftJS/)
    
import { Buffer } from 'buffer';

function encodeVarint(num: number): number[] {
  if (Number.MAX_SAFE_INTEGER && num > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Could not encode varint');
  }

  const MSB = 0x80,
    REST = 0x7f,
    MSBALL = ~REST,
    INT = Math.pow(2, 31);

  const out = [];
  let offset = 0;

  while (num >= INT) {
    out[offset++] = (num & 0xff) | MSB;
    num /= 128;
  }
  while (num & MSBALL) {
    out[offset++] = (num & 0xff) | MSB;
    num >>>= 7;
  }
  out[offset] = num | 0;

  return out;
}
function decodeVarint(buf: Buffer, offset: number): [number, number] {
  const MSB = 0x80,
    REST = 0x7f,
    MATH_POW_4 = Math.pow(2, 4 * 7),
    MATH_POW_5 = Math.pow(2, 5 * 7),
    MATH_POW_6 = Math.pow(2, 6 * 7),
    MATH_POW_7 = Math.pow(2, 7 * 7);

  offset = offset || 0;

  let b = buf[offset];
  let res = 0;

  res += b & REST;
  if (b < MSB) {
    return [res, 1];
  }

  b = buf[offset + 1];
  res += (b & REST) << 7;
  if (b < MSB) {
    return [res, 2];
  }

  b = buf[offset + 2];
  res += (b & REST) << 14;
  if (b < MSB) {
    return [res, 3];
  }

  b = buf[offset + 3];
  res += (b & REST) << 21;
  if (b < MSB) {
    return [res, 4];
  }

  b = buf[offset + 4];
  res += (b & REST) * MATH_POW_4;
  if (b < MSB) {
    return [res, 5];
  }

  b = buf[offset + 5];
  res += (b & REST) * MATH_POW_5;
  if (b < MSB) {
    return [res, 6];
  }

  b = buf[offset + 6];
  res += (b & REST) * MATH_POW_6;
  if (b < MSB) {
    return [res, 7];
  }

  b = buf[offset + 7];
  res += (b & REST) * MATH_POW_7;
  if (b < MSB) {
    return [res, 8];
  }

  throw new RangeError('Could not decode varint');
}

export class BufWrapper {
  /**
   * The wrapped NodeJS buffer
   */
  public buffer: Buffer;
  /**
   * Current offset (used for reading)
   */
  public offset: number;
  /**
   * Options that apply to the current \`BufWrapper\` instance
   */
  public options?: BufWrapperOptions;

  /** List of buffers, used for the \`oneConcat\` option */
  private buffers: Buffer[];

  /**
   * Create a new buffer wrapper instance
   * @param buffer The NodeJS buffer to wrap, optional
   * @param options Options to apply to the buffer wrapper, optional
   */
  public constructor(buffer?: Buffer | null, options: BufWrapperOptions = {}) {
    this.buffer = buffer || Buffer.alloc(0);
    this.offset = 0;
    this.buffers = [];
    this.options = options;
  }

  /**
   * Write a varint to the buffer
   * @param value The value to write (number)
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeVarInt(300);
   * console.log(buf.buffer); // <Buffer ac 02>
   * \`\`\`
   */
  public writeVarInt(value: number): void {
    const encoded = encodeVarint(value);
    this.writeToBuffer(Buffer.from(encoded));
  }

  /**
   * Read a varint from the buffer
   * @returns The varint value read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([0xac, 0x02]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readVarInt();
   * console.log(decoded); // 300
   * \`\`\`
   */
  public readVarInt(): number {
    const data = decodeVarint(this.buffer, this.offset);
    const value = data[0];
    this.offset += data[1];
    return value;
  }

  /**
   * Write a string to the buffer (will use the ut8 encoding)
   * @param value The value to write (string)
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeString('Hello World');
   * console.log(buf.buffer); // <Buffer 0b 48 65 6c 6c 6f 20 57 6f 72 6c 64>
   * \`\`\`
   */
  public writeString(value: string): void {
    this.writeVarInt(value.length);
    this.writeToBuffer(Buffer.from(value));
  }

  /**
   * Read a string from the buffer (will use the ut8 encoding)
   * @returns The string value read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([0x0b, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readString();
   * console.log(decoded); // Hello World
   * \`\`\`
   */
  public readString(): string {
    let length = this.readVarInt();

    let value = '';
    while (length > 0) {
      const next = this.buffer.toString('utf8', this.offset, this.offset + length);
      this.offset += length;
      length -= next.length;
      value += next;
    }
    
    return value;
  }

  /**
   * Write an integer to the buffer
   * @param value The value to write (number)
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeInt(123);
   * console.log(buf.buffer); // <Buffer 00 00 00 7b>
   * \`\`\`
   */
  public writeInt(value: number): void {
    const buf = Buffer.alloc(4);
    buf.writeInt32BE(value);
    this.writeToBuffer(buf);
  }

  /**
   * Read an integer from the buffer
   * @returns The integer value read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([0x00, 0x00, 0x00, 0x7b]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readInt();
   * console.log(decoded); // 123
   * \`\`\`
   */
  public readInt(): number {
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  /**
   * Write a long to the buffer
   * @param value The value to write (number)
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeLong(123456789n);
   * console.log(buf.buffer); // <Buffer 00 00 00 00 07 5b cd 15>
   * \`\`\`
   */
  public writeLong(value: number | bigint): void {
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(value));
    this.writeToBuffer(buf);
  }

  /**
   * Read a long from the buffer
   * @returns The long value read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07, 0x5b, 0xcd, 0x15]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readLong(true);
   * console.log(decoded); // 123456789n
   * \`\`\`
   */
  public readLong(bigint?: false): number;
  public readLong(bigint?: true): bigint;
  public readLong(bigint: boolean = false): number | bigint {
    const value = this.buffer.readBigInt64BE(this.offset);
    this.offset += 8;
    return Number(value);
  }

  /**
   * Write an array of strings to the buffer
   * @param value The value to write (string[])
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeStringArray(['Hello', 'World']);
   * console.log(buf.buffer); // <Buffer 02 05 48 65 6c 6c 6f 05 57 6f 72 6c 64>
   * \`\`\`
   */
  public writeStringArray(value: string[]): void {
    this.writeVarInt(value.length);
    value.forEach(v => this.writeString(v));
  }

  /**
   * Read an array of strings from the buffer
   * @returns The array read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([0x02, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x05, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readStringArray();
   * console.log(decoded); // ['Hello', 'World']
   * \`\`\`
   */
  public readStringArray(): string[] {
    const length = this.readVarInt();
    const value: string[] = [];
    for (let i = 0; i < length; i++) {
      value.push(this.readString());
    }
    return value;
  }

  /**
   * Write an array of ints to the buffer
   * @param value The value to write (number[])
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeIntArray([1, 2, 3]);
   * console.log(buf.buffer); // <Buffer 03 00 00 00 01 00 00 00 02 00 00 00 03>
   * \`\`\`
   */
  public writeIntArray(value: number[]): void {
    this.writeVarInt(value.length);
    value.forEach(v => this.writeInt(v));
  }

  /**
   * Read an array of ints from the buffer
   * @returns The array read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([ 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03 ]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readIntArray();
   * console.log(decoded); // [ 1, 2, 3 ]
   * \`\`\`
   */
  public readIntArray(): number[] {
    const length = this.readVarInt();
    const value: number[] = [];
    for (let i = 0; i < length; i++) {
      value.push(this.readInt());
    }
    return value;
  }

  /**
   * Write raw bytes to the buffer
   * @param value The value to write (a buffer or an array of bytes)
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeBytes([ 0x01, 0x02, 0x03 ]);
   * console.log(buf.buffer); // <Buffer 01 02 03>
   * \`\`\`
   */
  public writeBytes(value: Buffer | number[]): void {
    this.writeToBuffer(Buffer.from(value));
  }

  /**
   * Read raw bytes from the buffer
   * @param length The number of bytes to read
   * @returns The bytes read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([ 0x01, 0x02, 0x03 ]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readBytes(3);
   * console.log(decoded); // <Buffer 01 02 03>
   * \`\`\`
   */
  public readBytes(length: number): Buffer {
    const value = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  /**
   * Write a boolean to the buffer
   * @param value The value to write (boolean)
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeBoolean(true);
   * console.log(buf.buffer); // <Buffer 01>
   * \`\`\`
   */
  public writeBoolean(value: boolean): void {
    this.writeToBuffer(Buffer.from([value ? 1 : 0]));
  }

  /**
   * Read a boolean from the buffer
   * @returns The boolean read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([ 0x01 ]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readBoolean();
   * console.log(decoded); // true
   * \`\`\`
   */
  public readBoolean(): boolean {
    const value = this.buffer.readUInt8(this.offset) === 1;
    this.offset += 1;
    return value;
  }

  /**
   * Write a float to the buffer
   * @param value The value to write (number)
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeFloat(12.34);
   * console.log(buf.buffer); // <Buffer 41 45 70 a4>
   * \`\`\`
   */
  public writeFloat(value: number): void {
    const buf = Buffer.alloc(4);
    buf.writeFloatBE(value);
    this.writeToBuffer(buf);
  }

  /**
   * Read a float from the buffer
   * @returns The float read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([ 0x41, 0x45, 0x70, 0xa4 ]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readFloat();
   * console.log(decoded); // 12.34000015258789
   * \`\`\`
   */
  public readFloat(): number {
    const value = this.buffer.readFloatBE(this.offset);
    this.offset += 4;
    return value;
  }

  /**
   * Write a short to the buffer
   * @param value The value to write (number)
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeShort(42);
   * console.log(buf.buffer); // <Buffer 00 2a>
   * \`\`\`
   */
  public writeShort(value: number): void {
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE(value);
    this.writeToBuffer(buf);
  }

  /**
   * Read a float from the buffer
   * @returns The float read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([ 0x00, 0x2a ]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readShort();
   * console.log(decoded); // 42
   * \`\`\`
   */
  public readShort(): number {
    const value = this.buffer.readInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  /**
   * Write a double to the buffer
   * @param value The value to write (number)
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeDouble(42.42);
   * console.log(buf.buffer); // <Buffer 40 45 35 c2 8f 5c 28 f6>
   * \`\`\`
   */
  public writeDouble(value: number): void {
    const buf = Buffer.alloc(8);
    buf.writeDoubleBE(value);
    this.writeToBuffer(buf);
  }

  /**
   * Read a double from the buffer
   * @returns The double read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([ 0x40, 4x45, 0x35, 0xc2, 0x8f, 0x5c, 0x28, 0xf6 ]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readShort();
   * console.log(decoded); // 42.42
   * \`\`\`
   */
  public readDouble(): number {
    const value = this.buffer.readDoubleBE(this.offset);
    this.offset += 8;
    return value;
  }
  

  /*
   * Write a UUID to the buffer
   * @param value The value to write
   * @example
   * \`\`\`javascript
   * const buf = new BufWrapper();
   * buf.writeUUID('c09b74b4-8c14-44cb-b567-6576a2daf1f9');
   * console.log(buf.buffer); // <Buffer C0 9B 74 B4 8C 14 44 CB B5 67 65 76 A2 DA F1 F9>
   * \`\`\`
   */
  public writeUUID(uuid: string): void {
    this.writeBytes(Buffer.from(uuid.replace(/-/g, ''), 'hex'));
  }

  /**
   * Read a UUID from the buffer
   * @param dashes Whether the UUID should have dashes
   * @returns The UUID read from the buffer
   * @example
   * \`\`\`javascript
   * const buffer = Buffer.from([ 0xC0, 0x9B, 0x74, 0xB4, 0x8C, 0x14, 0x44, 0xCB, 0xB5, 0x67, 0x65, 0x76, 0xA2, 0xDA, 0xF1, 0xF9 ]);
   * const buf = new BufWrapper(buffer);
   * const decoded = buf.readUUID(true);
   * console.log(decoded); // c09b74b4-8c14-44cb-b567-6576a2daf1f9
   * \`\`\`
   */
  public readUUID(dashes: boolean = true): string {
    const uuid = this.readBytes(16).toString('hex');

    if (!dashes) return uuid;

    return uuid.slice(0, 8) + '-' + uuid.slice(8, 12) + '-' + uuid.slice(12, 16) + '-' + uuid.slice(16, 20) + '-' + uuid.slice(20, 32);
  }

  /**
   * Write a blob of data with a length to the buffer
   * @param data The blob of data
   * @example
   * \`\`\`javascript
   * // TO-DO
   * \`\`\`
   */
  public writeBlob(data: Buffer): void {
    this.writeShort(data.length);
    this.writeBytes(data);
  }

  /**
   * Read a blob of data from the buffer
   * @returns the blob of data read from the buffer
   * @example
   * \`\`\`javascript
   * // TO-DO
   * \`\`\`
   */
  public readBlob(): Buffer {
    const length = this.readShort();

    return this.readBytes(length);
  }

  /**
   * When the \`BufWrapperOptions#oneConcat\` is set to \`true\`
   * you must call this method to concatenate all buffers
   * into one. If the option is \`undefined\` or set to \`false\`,
   * this method will throw an error.
   *
   * This method will also set the \`BufWrapper#buffer\` to the
   * concatenated buffer.
   * @returns The concatenated buffer.
   */
  public finish(): Buffer {
    if (this.options?.oneConcat !== true) throw new Error("Can't call BufWrapper#finish without oneConcat option set to true");

    const buf = Buffer.concat([...this.buffers]);
    this.buffer = buf;
    return buf;
  }

  /**
   * Concat the given buffers into the main buffer
   * if \`BufWrapperOptions#oneConcat\` is \`false\` or \`undefined\`.
   * Otherwise, it will push the buffer to the \`BufWrapper#buffers\`
   * array.
   * @param value The buffers to write (array of buffers)
   */
  public writeToBuffer(...buffers: Buffer[]): void {
    if (this.options?.oneConcat === true) this.buffers.push(...buffers);
    else this.buffer = Buffer.concat([this.buffer, ...buffers]);
  }
}

type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;

export interface BufWrapperOptions {
  /**
   * Whether or not to run the \`Buffer#concat\` method when writing.
   * When set to \`true\`, you will have to call the \`BufWrapper#finish\`
   * method to get the final buffer. (Making this true and calling)
   * the \`BufWrapper#finish\` will increase performance.
   * When set to \`false\`, the \`BufWrapper#finish\` method will throw an error
   * and the \`Buffer#concat\` will be run every time you write something
   * to the buffer.
   */
  oneConcat?: boolean;
}`,
    'Packet.ts': `import { BufWrapper } from './BufWrapper';

export default class Packet<T = any> {
  public static readonly id: number;

  public buf: BufWrapper;
  public data: T;

  public constructor(buf?: BufWrapper) {
this.buf = buf!;
  }

  public write(data: T): void {}

  public read(): void {}
}`,
  };

  function genReadCode(data: ProtocolSpecData, keys = []) {
    const lines = keys.length && Object.keys(data).length === 1 && (ProtocolSpecRegularDataTypes.includes(data[Object.keys(data)[0]] as any) || ProtocolSpecRegularDataTypes.includes((data[Object.keys(data)[0]] as any).type) || (data[Object.keys(data)[0]] as any).type === 'array' || ((data[Object.keys(data)[0]] as any).type === 'object' && (data[Object.keys(data)[0]] as any).data)) ? [] : [`this.data${keys.map(i => ((i.startsWith('[') && i.endsWith(']')) || i === '' ? i : `.${i}`)).join('')} = {} as any;`];

    for (const key in data) {
      if (!keys.length) lines.push('');
      const keyPath = `${keys.map(i => ((i.startsWith('[') && i.endsWith(']')) || i === '' ? i : `.${i}`)).join('')}${(key.startsWith('[') && key.endsWith(']')) || key === '' ? key : `.${key}`}`;
      const rawItem = data[key];
      const item =
        typeof rawItem === 'string'
          ? {
              type: rawItem,
            }
          : rawItem;

      if (ProtocolSpecSpecialDataTypes.includes(item.type as any)) {
        switch (item.type) {
          case 'array':
            lines.push(`this.data${keyPath} = [];`);
            switch ((item as any).indexer) {
              case 'varInt':
              case undefined:
              case null:
                lines.push(`const ${key}Length = this.buf.readVarInt();`);
                break;

              case 'int':
                lines.push(`const ${key}Length = this.buf.readInt();`);
                break;

              case 'short':
                lines.push(`const ${key}Length = this.buf.readShort();`);
                break;

              case 'long':
                lines.push(`const ${key}Length = this.buf.readLong();`);
                break;

              default:
                lines.push(`const ${key}Length = ${(item as any).indexer};`);
                break;
            }
            lines.push(`for (let ${key}Index = 0; ${key}Index < ${key}Length; ${key}Index++) {`);
            lines.push(...(ProtocolSpecRegularDataTypes.includes(item.data as any) ? genReadCode({ [`[${key}Index]`]: item.data as any }, [...(typeof keys === 'string' ? [keys] : keys), key]) : genReadCode(item.data as any, [...(typeof keys === 'string' ? [keys] : keys), key, `[${key}Index]`])).map(i => `  ${i}`));
            lines.push('}');

            break;

          case 'object':
            if ((item as any).data) {
              lines.push(...genReadCode((item as any).data, [...(typeof keys === 'string' ? [keys] : keys), key]).map(i => (!keys.length ? i : `  ${i}`)));
            } else {
              lines.push(`const ${key}Length = this.buf.readVarInt();`);
              lines.push(`for (let ${key}Index = 0; ${key}Index < ${key}Length; ${key}Index++) {`);
              lines.push(`  const key = this.buf.read${capitalize((item as any).keyType)}();`);
              lines.push('');
              lines.push(
                ...genReadCode(
                  {
                    '': (item as any).valueType,
                  },
                  [...(typeof keys === 'string' ? [keys] : keys), key, '[key]']
                ).map(i => (ProtocolSpecRegularDataTypes.includes((item as any).valueType) || ProtocolSpecRegularDataTypes.includes((item as any).valueType.type) ? `  ${i}` : i))
              );
              lines.push('}');
            }
            break;

          case 'enum':
            lines.push(`this.data${keyPath} = ${(item as any).name}Enum[this.buf.read${capitalize((item as any).valueType || 'short')}()] as any;`);
            break;
        }
      } else {
        lines.push(`this.data${keyPath} = this.buf.read${capitalize(item.type)}();`);
      }
    }

    return lines;
  }
  function genWriteCode(data: ProtocolSpecData, keys: string | string[] = []) {
    const lines = [];

    const isMain = !keys.length;

    if (isMain) {
      resetNextChar();
      keys = ['data'];
    }

    for (const key in data) {
      if (isMain) lines.push('');

      const keyPath = typeof keys === 'string' ? `${keys}.${key}` : `${[...keys, key].map(i => ((i.startsWith('[') && i.endsWith(']')) || i == '' || keys.indexOf(i) === 0 ? i : `.${i}`)).join('')}`;
      const rawItem = data[key];
      const item =
        typeof rawItem === 'string'
          ? {
              type: rawItem,
            }
          : rawItem;

      if (ProtocolSpecSpecialDataTypes.includes(item.type as any)) {
        switch (item.type) {
          case 'array':
            const iteratorName = getNextChar();
            switch ((item as any).indexer) {
              case 'varInt':
              case undefined:
              case null:
                lines.push(`this.buf.writeVarInt(${keyPath}.length);`);
                break;

              case 'int':
                lines.push(`this.buf.writeInt(${keyPath}.length);`);
                break;

              case 'short':
                lines.push(`this.buf.writeShort(${keyPath}.length);`);
                break;

              case 'long':
                lines.push(`this.buf.writeLong(${keyPath}.length);`);
                break;

              default:
                // No need to write length
                break;
            }
            lines.push(`for (const ${iteratorName} of ${keyPath}) {`);
            lines.push(...(ProtocolSpecRegularDataTypes.includes(item.data as any) ? genWriteCode({ '': item.data as any }, [iteratorName]) : genWriteCode(item.data as any, iteratorName)).map(i => `  ${i}`));
            lines.push('}');

            break;

          case 'object':
            if ((item as any).data) {
              lines.push(...genWriteCode((item as any).data, [...(typeof keys === 'string' ? [keys] : keys), key]).map(i => (isMain ? i : `  ${i}`)));
            } else {
              lines.push(`this.buf.writeVarInt(Object.keys(${keyPath}).length);`);
              lines.push(`for (const key in ${keyPath}) {`);
              lines.push(`  this.buf.write${capitalize((item as any).keyType)}(${typeMappings[(item as any).keyType] === 'number' ? 'Number(key)' : 'key'});`);
              lines.push('');
              lines.push(
                ...genWriteCode(
                  {
                    '': (item as any).valueType,
                  },
                  [...(typeof keys === 'string' ? [keys] : keys), key, '[key]']
                ).map(i => (ProtocolSpecRegularDataTypes.includes((item as any).valueType) || ProtocolSpecRegularDataTypes.includes((item as any).valueType.type) ? `  ${i}` : i))
              );
              lines.push('}');
            }
            break;

          case 'enum':
            lines.push(`this.buf.write${capitalize((item as any).valueType || 'short')}(${(item as any).name}Enum[${keyPath}]);`);
            break;
        }
      } else {
        lines.push(`this.buf.write${capitalize(item.type)}(${keyPath});`);
      }
    }

    return lines;
  }
  function genInterface(data: ProtocolSpecData) {
    const lines = [];

    for (const key in data) {
      const item = data[key];

      if (typeof item === 'string') {
        lines.push(`${key}: ${typeMappings[item]};`);
      } else {
        if (ProtocolSpecSpecialDataTypes.includes((item as any).type)) {
          switch (item.type) {
            case 'array':
              if (ProtocolSpecRegularDataTypes.includes(item.data as any)) lines.push(`${key}: ${typeMappings[item.data as any]}[];`);
              else lines.push(`${key}: {`, ...genInterface(item.data as any), '}[];');
              break;

            case 'object':
              if ((item as any).data) {
                lines.push(`${key}: {`, ...genInterface((item as any).data), '};');
              } else {
                lines.push(
                  `${key}: {`,
                  ...genInterface({
                    [`[key: ${typeMappings[(item as any).keyType]}]`]: (item as any).valueType,
                  }),
                  '};'
                );
              }
              break;

            case 'enum':
              lines.push(`${key}: ${(item as any).values.map(i => `"${i}"`).join(' | ')};`);
              break;
          }
        } else {
          lines.push(`${key}: ${typeMappings[item.type]};`);
        }
      }
    }

    return lines.map(i => `  ${i}`);
  }
  function genEnums(data: ProtocolSpecData) {
    const lines = [];

    for (const key in data) {
      const item = data[key];
      const type = typeof item === 'string' ? item : item.type;

      if (type === 'enum') {
        const name = (item as any).name;
        const values = (item as any).values;

        lines.push(`export enum ${name}Enum {\n${values.map(v => `  ${v} = ${values.indexOf(v)},`).join('\n')}\n}`);
      } else if ((item as any)?.data) {
        lines.push(...genEnums((item as any)?.data));
      } else if ((item as any)?.valueType) {
        lines.push(...genEnums((item as any)?.valueType));
      }
    }

    return lines;
  }

  for (const name in spec) {
    const item = spec[name];

    files[`${name}Packet.ts`] = `import { BufWrapper } from './BufWrapper';

import Packet from './Packet';

export default class ${name}Packet extends Packet<${name}> {
  public static readonly id = ${item.id};

  public constructor(buf?: BufWrapper) {
    super(buf);
  }

  public write(data: ${name}): void {
    this.data = data;

    this.buf = new BufWrapper(null, { oneConcat: true });
    this.buf.writeVarInt(${name}Packet.id); // Packet ID
${genWriteCode(item.data)
  .map(i => `    ${i}`)
  .join('\n')}

    this.buf.finish();
  }

  public read(): ${name} {
${genReadCode(item.data)
  .map(i => `    ${i}`)
  .join('\n')}

    return this.data;
  }
}

export interface ${name} {
${genInterface(item.data).join('\n')}
}

${genEnums(item.data).join('\n\n')}`;
  }

  files['index.ts'] = `import { BufWrapper } from "./BufWrapper";
import Packet from "./Packet";
  
${Object.keys(spec)
  .map(name => `import ${name}Packet from "./${name}Packet";`)
  .join('\n')}
  
type ArrayElement<ArrayType extends readonly unknown[]> = ArrayType extends readonly (infer ElementType)[] ? ElementType : never;
type ValueOf<T> = T[keyof T]

// Incoming

export const IncomingPackets${Object.keys(spec).filter(i => spec[i].direction === 'incoming' || spec[i].direction === 'both').length ? '' : ': (typeof Packet<any>)[]'} = [
${Object.keys(spec)
  .filter(i => spec[i].direction === 'incoming' || spec[i].direction === 'both')
  .map(name => `  ${name}Packet,`)
  .join('\n')}
];

export type IncomingPacketTypes = {
  [key in ArrayElement<typeof IncomingPackets>['id']]: Extract<ArrayElement<typeof IncomingPackets>, { id: key }> extends typeof Packet<infer U> ? U : never;
};

export enum IncomingPacketIDs {
${Object.keys(spec)
  .filter(i => spec[i].direction === 'incoming' || spec[i].direction === 'both')
  .map(name => `  ${name} = ${spec[name].id},`)
  .join('\n')}
};

export function writeIncomingPacket<T extends keyof IncomingPacketTypes>(
  id: T,
  data: IncomingPacketTypes[T]
): Packet {
  const Packet = IncomingPackets.find(p => p.id == id);

  if(!Packet) throw new Error(\`\${id} is not a valid Incoming Packet ID!\`);

  const packet = new Packet();
  packet.write(data as any);

  return packet;
}

export function readIncomingPacket<T extends keyof IncomingPacketTypes>(data: Buffer): ValueOf<{
  [V in T]: {
    id: V;
    packet: Packet<IncomingPacketTypes[V]>;
    data: IncomingPacketTypes[V];
  };
}> {
  const buf = new BufWrapper(data);

  const id = buf.readVarInt();
  const Packet = IncomingPackets.find(p => p.id == id);

  if(!Packet) throw new Error(\`Could not find Incoming Packet with ID \${id}\`);

  const packet = new Packet(buf);
  packet.read();

  return {
    id: Packet.id,
    packet: packet as any,
    data: packet.data
  } as any;
}

// Outgoing

export const OutgoingPackets${Object.keys(spec).filter(i => spec[i].direction === 'outgoing' || spec[i].direction === 'both').length ? '' : ': (typeof Packet<any>)[]'} = [
${Object.keys(spec)
  .filter(i => spec[i].direction === 'outgoing' || spec[i].direction === 'both')
  .map(name => `  ${name}Packet,`)
  .join('\n')}
];

export type OutgoingPacketTypes = {
  [key in ArrayElement<typeof OutgoingPackets>['id']]: Extract<ArrayElement<typeof OutgoingPackets>, { id: key }> extends typeof Packet<infer U> ? U : never;
};

export enum OutgoingPacketIDs {
${Object.keys(spec)
  .filter(i => spec[i].direction === 'outgoing' || spec[i].direction === 'both')
  .map(name => `  ${name} = ${spec[name].id},`)
  .join('\n')}
};

export function writeOutgoingPacket<T extends keyof OutgoingPacketTypes>(
  id: T,
  data: OutgoingPacketTypes[T]
): Packet {
  const Packet = OutgoingPackets.find(p => p.id == id);

  if(!Packet) throw new Error(\`\${id} is not a valid Outgoing Packet ID!\`);

  const packet = new Packet();
  packet.write(data as any);

  return packet;
}

export function readOutgoingPacket<T extends keyof OutgoingPacketTypes>(data: Buffer): ValueOf<{
  [V in T]: {
    id: V;
    packet: Packet<OutgoingPacketTypes[V]>;
    data: OutgoingPacketTypes[V];
  };
}> {
  const buf = new BufWrapper(data);

  const id = buf.readVarInt();
  const Packet = OutgoingPackets.find(p => p.id == id);

  if(!Packet) throw new Error(\`Could not find Outgoing Packet with ID \${id}\`);

  const packet = new Packet(buf);
  packet.read();

  return {
    id: Packet.id,
    packet: packet as any,
    data: packet.data
  } as any;
}`;

  for (const file in files) await writeFile(join(output, file), files[file], 'utf-8');
}
