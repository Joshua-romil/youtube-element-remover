import fs from "node:fs";
import zlib from "node:zlib";

const ICONS = [16, 32, 48, 128, 1024];

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(path, width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    makeChunk("IEND", Buffer.alloc(0)),
  ]));
}

function hexToRgba(hex, alpha = 1) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    Math.round(alpha * 255),
  ];
}

function blendPixel(pixels, width, x, y, color) {
  const index = (y * width + x) * 4;
  const sourceAlpha = color[3] / 255;
  const targetAlpha = pixels[index + 3] / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

  if (outputAlpha <= 0) return;

  pixels[index] = Math.round((color[0] * sourceAlpha + pixels[index] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 1] = Math.round((color[1] * sourceAlpha + pixels[index + 1] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 2] = Math.round((color[2] * sourceAlpha + pixels[index + 2] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 3] = Math.round(outputAlpha * 255);
}

function drawRect(pixels, width, rect, color) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(width, Math.ceil(rect.y + rect.h));

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) blendPixel(pixels, width, x, y, color);
  }
}

function drawRoundedRect(pixels, width, rect, radius, color) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(width, Math.ceil(rect.y + rect.h));
  const r = Math.min(radius, rect.w / 2, rect.h / 2);

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const cx = Math.max(rect.x + r, Math.min(px, rect.x + rect.w - r));
      const cy = Math.max(rect.y + r, Math.min(py, rect.y + rect.h - r));
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r ** 2) {
        blendPixel(pixels, width, x, y, color);
      }
    }
  }
}

function drawRoundedStroke(pixels, width, rect, radius, strokeWidth, color) {
  const inner = {
    x: rect.x + strokeWidth,
    y: rect.y + strokeWidth,
    w: rect.w - strokeWidth * 2,
    h: rect.h - strokeWidth * 2,
  };
  const innerRadius = Math.max(0, radius - strokeWidth);
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(width, Math.ceil(rect.y + rect.h));

  function insideRounded(px, py, box, r) {
    const cx = Math.max(box.x + r, Math.min(px, box.x + box.w - r));
    const cy = Math.max(box.y + r, Math.min(py, box.y + box.h - r));
    return (px - cx) ** 2 + (py - cy) ** 2 <= r ** 2;
  }

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (insideRounded(px, py, rect, radius) && !insideRounded(px, py, inner, innerRadius)) {
        blendPixel(pixels, width, x, y, color);
      }
    }
  }
}

function drawTriangle(pixels, width, points, color) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x))));
  const maxX = Math.min(width, Math.ceil(Math.max(...points.map((p) => p.x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
  const maxY = Math.min(width, Math.ceil(Math.max(...points.map((p) => p.y))));
  const [a, b, c] = points;
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w1 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area;
      const w2 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area;
      const w3 = 1 - w1 - w2;
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) blendPixel(pixels, width, x, y, color);
    }
  }
}

function drawCircle(pixels, width, cx, cy, radius, color) {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(width, Math.ceil(cx + radius));
  const y1 = Math.min(width, Math.ceil(cy + radius));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius ** 2) {
        blendPixel(pixels, width, x, y, color);
      }
    }
  }
}

function downsample(source, sourceSize, targetSize, samples) {
  const target = Buffer.alloc(targetSize * targetSize * 4);
  const block = samples * samples;

  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const sums = [0, 0, 0, 0];
      for (let by = 0; by < samples; by += 1) {
        for (let bx = 0; bx < samples; bx += 1) {
          const sourceIndex = ((y * samples + by) * sourceSize + x * samples + bx) * 4;
          sums[0] += source[sourceIndex];
          sums[1] += source[sourceIndex + 1];
          sums[2] += source[sourceIndex + 2];
          sums[3] += source[sourceIndex + 3];
        }
      }
      const targetIndex = (y * targetSize + x) * 4;
      target[targetIndex] = Math.round(sums[0] / block);
      target[targetIndex + 1] = Math.round(sums[1] / block);
      target[targetIndex + 2] = Math.round(sums[2] / block);
      target[targetIndex + 3] = Math.round(sums[3] / block);
    }
  }

  return target;
}

function drawIcon(size) {
  const samples = size >= 512 ? 2 : 4;
  const canvasSize = size * samples;
  const pixels = Buffer.alloc(canvasSize * canvasSize * 4);
  const scale = canvasSize / 128;
  const r = (value) => value * scale;
  const rect = (x, y, w, h) => ({ x: r(x), y: r(y), w: r(w), h: r(h) });

  drawRoundedRect(pixels, canvasSize, rect(7, 7, 114, 114), r(24), hexToRgba("#14191d"));
  drawRoundedStroke(pixels, canvasSize, rect(8.5, 8.5, 111, 111), r(22.5), r(3), hexToRgba("#2e353d"));

  drawRoundedRect(pixels, canvasSize, rect(24, 35, 65, 50), r(7), hexToRgba("#f6f7f8"));
  drawRoundedRect(pixels, canvasSize, rect(29, 40, 55, 40), r(4), hexToRgba("#0b1115"));
  drawTriangle(pixels, canvasSize, [
    { x: r(46), y: r(49) },
    { x: r(46), y: r(71) },
    { x: r(66), y: r(60) },
  ], hexToRgba("#f6f7f8"));

  drawRoundedRect(pixels, canvasSize, rect(31, 78, 47, 4), r(2), hexToRgba("#3a4149"));
  drawRoundedRect(pixels, canvasSize, rect(31, 78, 22, 4), r(2), hexToRgba("#ff3b2f"));
  drawCircle(pixels, canvasSize, r(55), r(80), r(4), hexToRgba("#f6f7f8"));

  [
    [39, "#ff3b2f", 1],
    [54, "#ec3128", 0.86],
    [69, "#d42822", 0.62],
    [84, "#b91f1c", 0.38],
  ].forEach(([y, color, alpha]) => {
    drawRoundedRect(pixels, canvasSize, rect(95, y, 13, 10), r(2), hexToRgba(color, alpha));
  });

  [
    [113, 45, 2.2, 1],
    [118, 53, 1.8, 0.85],
    [114, 62, 1.7, 0.7],
    [120, 72, 1.4, 0.55],
    [113, 82, 1.2, 0.4],
    [119, 93, 1, 0.28],
  ].forEach(([x, y, radius, alpha]) => {
    drawCircle(pixels, canvasSize, r(x), r(y), r(radius), hexToRgba("#ff5a45", alpha));
  });

  return downsample(pixels, canvasSize, size, samples);
}

fs.mkdirSync("images", { recursive: true });
for (const size of ICONS) {
  writePng(`images/icon-${size}.png`, size, size, drawIcon(size));
}
