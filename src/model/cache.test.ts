/**
 * The gate that keeps iPhones from being offered a download their tab cannot
 * survive. The two ceilings below are field-measured adapter limits, not
 * invented numbers: iOS Safari 26 reports ~716 MB; a Pixel 8a and this
 * project's own M3 Air both report the full 4 GB.
 */
import { describe, expect, it } from 'vitest';
import { MODEL_BYTES, modelFitsIn } from './cache';

describe('modelFitsIn', () => {
  it('blocks the measured iPhone ceiling', () => {
    expect(modelFitsIn(715_827_880)).toBe(false);
  });

  it('passes the measured desktop and Android ceilings', () => {
    expect(modelFitsIn(4_294_967_292)).toBe(true);
  });

  it('sits exactly on the model size', () => {
    expect(modelFitsIn(MODEL_BYTES)).toBe(true);
    expect(modelFitsIn(MODEL_BYTES - 1)).toBe(false);
  });
});
