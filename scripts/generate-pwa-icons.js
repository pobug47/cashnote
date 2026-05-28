const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.join(__dirname, "..");
const assetsDir = path.join(root, "assets");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function rgba(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    255
  ];
}

function insideRoundedRect(x, y, left, top, width, height, radius) {
  const right = left + width;
  const bottom = top + height;
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  return x >= left && x < right && y >= top && y < bottom && (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function drawIcon(size) {
  const dark = rgba("#183327");
  const green = rgba("#28724f");
  const light = rgba("#b9e4c9");
  const white = rgba("#f6fbf7");
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      let color = dark;

      if (insideRoundedRect(x, y, size * 0.15, size * 0.15, size * 0.7, size * 0.7, size * 0.16)) {
        color = light;
      }
      if (insideRoundedRect(x, y, size * 0.24, size * 0.28, size * 0.52, size * 0.12, size * 0.035)) {
        color = green;
      }
      if (insideRoundedRect(x, y, size * 0.24, size * 0.46, size * 0.52, size * 0.12, size * 0.035)) {
        color = green;
      }
      if (insideRoundedRect(x, y, size * 0.24, size * 0.64, size * 0.34, size * 0.12, size * 0.035)) {
        color = green;
      }
      if (insideRoundedRect(x, y, size * 0.62, size * 0.62, size * 0.14, size * 0.14, size * 0.07)) {
        color = white;
      }

      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = color[3];
    }
  }

  const rows = [];
  for (let y = 0; y < size; y += 1) {
    rows.push(Buffer.from([0]), pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

fs.mkdirSync(assetsDir, { recursive: true });
[
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["maskable-icon-512.png", 512],
  ["apple-touch-icon.png", 180]
].forEach(([name, size]) => {
  fs.writeFileSync(path.join(assetsDir, name), drawIcon(size));
});

console.log("PWA icons generated.");
