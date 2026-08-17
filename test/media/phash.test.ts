import { describe, expect, it } from 'vitest';
import { dHash, hammingDistance, isNearDuplicate } from '../../src/media/phash.js';
import { checkerboardImage, solidImage } from './testImages.js';

describe('dHash / hammingDistance', () => {
  it('is identical for the same image', async () => {
    const image = await checkerboardImage();
    const a = await dHash(image);
    const b = await dHash(image);
    expect(hammingDistance(a, b)).toBe(0);
    expect(isNearDuplicate(a, b)).toBe(true);
  });

  it('flags visually different images as not near-duplicate', async () => {
    const checker = await dHash(await checkerboardImage(8));
    const solid = await dHash(await solidImage(128));
    expect(isNearDuplicate(checker, solid)).toBe(false);
  });

  it('still recognizes a near-identical re-encode as a duplicate', async () => {
    const original = await checkerboardImage(8);
    const reencoded = await checkerboardImage(8);
    const a = await dHash(original);
    const b = await dHash(reencoded);
    expect(isNearDuplicate(a, b)).toBe(true);
  });
});
