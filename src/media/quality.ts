import sharp from 'sharp';

const LAPLACIAN_KERNEL = {
  width: 3,
  height: 3,
  kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
};

// Variance of the Laplacian: a sharp image has high-frequency edges everywhere,
// so the Laplacian response varies a lot; a blurry image is smooth, so it doesn't.
export async function blurScore(imageBuffer: Buffer): Promise<number> {
  const { data, info } = await sharp(imageBuffer)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .convolve(LAPLACIAN_KERNEL)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] ?? 0;
  }
  const mean = sum / pixelCount;

  let variance = 0;
  for (let i = 0; i < data.length; i++) {
    const diff = (data[i] ?? 0) - mean;
    variance += diff * diff;
  }
  variance /= pixelCount;

  return variance;
}

// Below this Laplacian-variance threshold, the shot is treated as too blurry to post.
// Tuned empirically against a sharp vs. blurred sample pair (see test/media/quality.test.ts) —
// revisit if real submissions show false positives/negatives.
export const BLUR_THRESHOLD = 40;

export function isTooBlurry(score: number): boolean {
  return score < BLUR_THRESHOLD;
}
