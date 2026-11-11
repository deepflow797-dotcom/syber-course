#!/usr/bin/env node
/* Re-encodes a PNG losslessly at 8 bits per channel.
   The shipped PWA icons are 16-bit RGBA (64 bits per pixel) for flat-colour art, which is more than double
   the bytes needed: the browser has to download every bit of it. This writes the same pixels as an 8-bit
   RGBA PNG with a Paeth filter and max deflate, and reports the size change.
   Only 8/16-bit truecolour PNGs without interlacing are handled (that is what the repo ships). */
import fs from "node:fs";
import zlib from "node:zlib";

/** The PNG filter predictor for one byte (filters 0-4 of the specification). */
function predictorOf(filter, left, up, upLeft) {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return (left + up) >> 1;
  if (filter !== 4) throw new Error(`bad filter ${filter}`);
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
}

/** Walks the PNG chunk list, collecting IHDR fields and the IDAT payload. */
function readChunks(file, buf) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  return { width, height, bitDepth, colorType, interlace, idat };
}

/** Decodes a PNG to 8-bit RGBA. */
export function decodePng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);
  const { width, height, bitDepth, colorType, interlace, idat } = readChunks(file, buf);
  if (![8, 16].includes(bitDepth)) throw new Error(`${file}: bit depth ${bitDepth} not supported`);
  if (interlace) throw new Error(`${file}: interlaced PNG not supported`);
  if (colorType !== 6 && colorType !== 2) throw new Error(`${file}: colour type ${colorType} not supported`);
  const channels = colorType === 6 ? 4 : 3;
  const bytesPerSample = bitDepth / 8;
  const bpp = channels * bytesPerSample;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height * 4);
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const value = raw[pos++];
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      line[x] = (value + predictorOf(filter, a, b, c)) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      for (let ch = 0; ch < 3; ch++) out[o + ch] = line[x * bpp + ch * bytesPerSample];
      out[o + 3] = channels === 4 ? line[x * bpp + 3 * bytesPerSample] : 255;
    }
    line.copy(prev);
  }
  return { width, height, rgba: out };
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([length, body, crcBuf]);
}

/** Writes an 8-bit RGBA PNG using a Paeth filter on every line. */
export function encodePng({ width, height, rgba }, file) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 4; // Paeth
    for (let x = 0; x < stride; x++) {
      const value = rgba[y * stride + x];
      const a = x >= 4 ? rgba[y * stride + x - 4] : 0;
      const b = y > 0 ? rgba[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? rgba[(y - 1) * stride + x - 4] : 0;
      raw[rowStart + 1 + x] = (value - predictorOf(4, a, b, c)) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

if (process.argv[2]) {
  const [input, output = input] = process.argv.slice(2);
  const before = fs.statSync(input).size;
  const image = decodePng(input);
  const after = encodePng(image, output);
  console.log(
    `${input}: ${image.width}x${image.height} ${before} -> ${after} bytes (${Math.round((1 - after / before) * 100)}% smaller)`
  );
}
