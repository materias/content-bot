import { describe, expect, it } from 'vitest';
import { blurScore, isTooBlurry } from '../../src/media/quality.js';
import { blurImage, checkerboardImage } from './testImages.js';

describe('blurScore / isTooBlurry', () => {
  it('scores a sharp high-frequency image above the threshold', async () => {
    const sharpImg = await checkerboardImage(4);
    const score = await blurScore(sharpImg);
    expect(isTooBlurry(score)).toBe(false);
  });

  it('scores a heavily blurred image below the threshold', async () => {
    const sharpImg = await checkerboardImage(4);
    const blurred = await blurImage(sharpImg, 15);
    const score = await blurScore(blurred);
    expect(isTooBlurry(score)).toBe(true);
  });

  it('gives the blurred image a lower score than the sharp one', async () => {
    const sharpImg = await checkerboardImage(4);
    const blurred = await blurImage(sharpImg, 15);
    const [sharpScore, blurredScore] = await Promise.all([
      blurScore(sharpImg),
      blurScore(blurred),
    ]);
    expect(blurredScore).toBeLessThan(sharpScore);
  });
});
