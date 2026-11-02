const ALGORITHM = 'pbkdf2-sha256'
const ITERATIONS = 120_000
const KEY_BYTES = 32

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function subtle(): SubtleCrypto {
  const value = globalThis.crypto?.subtle
  if (!value) {
    throw new Error(
      'Este navegador no permite el cifrado local. Abre la app por HTTPS o desde localhost.'
    )
  }
  return value
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    KEY_BYTES * 8
  )
  return new Uint8Array(bits)
}

export async function hashPin(pin: string): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(pin, salt, ITERATIONS)
  return `${ALGORITHM}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  if (typeof stored !== 'string') return false
  const [algorithm, iterationsText, saltText, hashText] = stored.split('$')
  const iterations = Number(iterationsText)
  if (
    algorithm !== ALGORITHM ||
    !Number.isInteger(iterations) ||
    iterations <= 0 ||
    !saltText ||
    !hashText
  ) {
    return false
  }

  try {
    const hash = await derive(pin, fromBase64(saltText), iterations)
    const expected = fromBase64(hashText)
    if (hash.length !== expected.length) return false
    let difference = 0
    for (let index = 0; index < hash.length; index += 1) {
      difference |= hash[index] ^ expected[index]
    }
    return difference === 0
  } catch {
    return false
  }
}

export function isPinHash(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith(`${ALGORITHM}$`) &&
    value.split('$').length === 4
  )
}
