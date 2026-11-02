// Genera los iconos PNG/SVG de la PWA sin dependencias externas.
// Uso: npm run icons
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ICONS_DIR = path.join(ROOT, 'public', 'icons')
const PUBLIC_DIR = path.join(ROOT, 'public')
fs.mkdirSync(ICONS_DIR, { recursive: true })

const SS = 3 // supersampling para bordes suaves

function crc32(buffer) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function drawIcon(size, { rounded }) {
  const hi = size * SS
  const pixels = new Float32Array(hi * hi * 4) // premultiplicado
  const radius = hi * 0.22
  const circleRadius = hi * 0.335
  const cx = hi / 2
  const cy = hi / 2

  const put = (index, r, g, b, a) => {
    pixels[index] = r * a
    pixels[index + 1] = g * a
    pixels[index + 2] = b * a
    pixels[index + 3] = a
  }

  const pointSegDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const lengthSq = dx * dx + dy * dy
    let t = lengthSq ? ((px - x1) * dx + (py - y1) * dy) / lengthSq : 0
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
  }

  const insideRounded = (x, y) => {
    const qx = Math.abs(x - hi / 2) - (hi / 2 - radius)
    const qy = Math.abs(y - hi / 2) - (hi / 2 - radius)
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
    const inside = Math.min(Math.max(qx, qy), 0)
    return outside + inside - radius <= 0
  }

  const check = [
    [0.37, 0.505],
    [0.462, 0.594],
    [0.638, 0.408],
  ].map(([x, y]) => [x * hi, y * hi])
  const stroke = hi * 0.038

  for (let y = 0; y < hi; y++) {
    for (let x = 0; x < hi; x++) {
      const index = (y * hi + x) * 4
      const px = x + 0.5
      const py = y + 0.5

      if (rounded && !insideRounded(px, py)) continue

      // Fondo verde con degradado vertical.
      const t = y / hi
      const bg = [21 + (16 - 21) * t, 128 + (75 - 128) * t, 61 + (38 - 61) * t]
      put(index, bg[0], bg[1], bg[2], 1)

      // Círculo blanco central.
      if (Math.hypot(px - cx, py - cy) <= circleRadius) {
        put(index, 255, 255, 255, 1)

        // Check verde dentro del círculo.
        const d1 = pointSegDist(px, py, ...check[0], ...check[1])
        const d2 = pointSegDist(px, py, ...check[1], ...check[2])
        if (Math.min(d1, d2) <= stroke) {
          put(index, 22, 101, 52, 1)
        }
      }
    }
  }

  // Downsample premultiplicado.
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * hi + (x * SS + sx)) * 4
          r += pixels[i]
          g += pixels[i + 1]
          b += pixels[i + 2]
          a += pixels[i + 3]
        }
      }
      const count = SS * SS
      const alpha = a / count
      const o = (y * size + x) * 4
      if (alpha > 0) {
        out[o] = Math.round(r / a)
        out[o + 1] = Math.round(g / a)
        out[o + 2] = Math.round(b / a)
        out[o + 3] = Math.round(alpha * 255)
      }
    }
  }

  return encodePng(size, out)
}

function write(file, buffer) {
  fs.writeFileSync(file, buffer)
  console.log(`Generado ${path.relative(ROOT, file)} (${buffer.length} bytes)`)
}

write(path.join(ICONS_DIR, 'icon-192.png'), drawIcon(192, { rounded: true }))
write(path.join(ICONS_DIR, 'icon-512.png'), drawIcon(512, { rounded: true }))
write(path.join(ICONS_DIR, 'icon-maskable-512.png'), drawIcon(512, { rounded: false }))
write(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), drawIcon(180, { rounded: false }))

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#15803d"/>
      <stop offset="1" stop-color="#14532d"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <circle cx="256" cy="256" r="172" fill="#ffffff"/>
  <path d="M176 260 L232 316 L340 208" fill="none" stroke="#166534" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), favicon)
console.log('Generado public/favicon.svg')
