import sharp from 'sharp';

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

// Difference hash: shrink to 9x8 greyscale, compare each pixel to its right
// neighbor. Produces a 64-bit fingerprint that's stable under recompression
// and minor crops but sensitive to genuinely different content.
export async function dHash(imageBuffer: Buffer): Promise<bigint> {
  const { data } = await sharp(imageBuffer)
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = 0n;
  for (let row = 0; row < HASH_HEIGHT; row++) {
    for (let col = 0; col < HASH_WIDTH - 1; col++) {
      const left = data[row * HASH_WIDTH + col] ?? 0;
      const right = data[row * HASH_WIDTH + col + 1] ?? 0;
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

// Out of a 64-bit hash, this many differing bits or fewer counts as a near-duplicate.
export const DUPLICATE_HAMMING_THRESHOLD = 6;

export function isNearDuplicate(a: bigint, b: bigint): boolean {
  return hammingDistance(a, b) <= DUPLICATE_HAMMING_THRESHOLD;
}
