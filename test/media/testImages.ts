import sharp from 'sharp';

const SIZE = 64;

export async function checkerboardImage(blockSize = 8): Promise<Buffer> {
  const raw = Buffer.alloc(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const isWhite = (Math.floor(x / blockSize) + Math.floor(y / blockSize)) % 2 === 0;
      raw[y * SIZE + x] = isWhite ? 255 : 0;
    }
  }
  return sharp(raw, { raw: { width: SIZE, height: SIZE, channels: 1 } }).png().toBuffer();
}

export async function solidImage(value = 128): Promise<Buffer> {
  const raw = Buffer.alloc(SIZE * SIZE, value);
  return sharp(raw, { raw: { width: SIZE, height: SIZE, channels: 1 } }).png().toBuffer();
}

export async function blurImage(imageBuffer: Buffer, sigma = 15): Promise<Buffer> {
  return sharp(imageBuffer).blur(sigma).png().toBuffer();
}
