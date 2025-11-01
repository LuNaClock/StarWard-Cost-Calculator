import { describe, it, expect } from 'vitest';
import { getDamageGaugeCoefficient, AVERAGE_GAUGE_COEFFICIENT } from '../data.js';

describe('getDamageGaugeCoefficient', () => {
  it('3.0コストの係数を返す', () => {
    expect(getDamageGaugeCoefficient(3.0)).toBeCloseTo(0.598, 3);
    expect(getDamageGaugeCoefficient(3)).toBeCloseTo(0.598, 3);
  });

  it('2.5/2.0/1.5コストの係数を返す', () => {
    expect(getDamageGaugeCoefficient(2.5)).toBeCloseTo(0.64, 3);
    expect(getDamageGaugeCoefficient(2.0)).toBeCloseTo(0.64, 3);
    expect(getDamageGaugeCoefficient(1.5)).toBeCloseTo(0.64, 3);
  });

  it('未知の入力には既定値を使う', () => {
    expect(getDamageGaugeCoefficient(4.0)).toBeCloseTo(AVERAGE_GAUGE_COEFFICIENT, 3);
    expect(getDamageGaugeCoefficient(Number.NaN)).toBeCloseTo(AVERAGE_GAUGE_COEFFICIENT, 3);
  });
});
