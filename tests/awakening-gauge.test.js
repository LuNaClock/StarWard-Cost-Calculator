import { describe, expect, it } from 'vitest';
import { calculateAwakeningGauge } from '../js/calculator.js';

const baseInputs = {
  gaugeBeforeShotdown: 0,
  damageTakenInputValue: 0,
  originalCharActualMaxHp: 2000,
  charCost: 2,
  charName: 'test',
  considerOwnDown: false,
  considerDamageDealt: false,
  damageDealtBonus: '0',
  considerPartnerCAwakening: false,
  partnerCAwakeningBonus: '0',
  considerShieldSuccess: false,
  shieldSuccessBonus: '0',
  considerPartnerDown: false,
};

describe('calculateAwakeningGauge partner C awakening bonus', () => {
  it('adds 19 percent for partner C awakening at 50 percent', () => {
    const result = calculateAwakeningGauge({
      ...baseInputs,
      considerPartnerCAwakening: true,
      partnerCAwakeningBonus: '50',
    });

    expect(result.finalPredictedGauge).toBe(19);
    expect(result.breakdown.partnerCAwakening).toEqual({
      enabled: true,
      value: 19,
    });
  });

  it('adds 46 percent for partner C awakening at 100 percent', () => {
    const result = calculateAwakeningGauge({
      ...baseInputs,
      considerPartnerCAwakening: true,
      partnerCAwakeningBonus: '100',
    });

    expect(result.finalPredictedGauge).toBe(46);
    expect(result.breakdown.partnerCAwakening).toEqual({
      enabled: true,
      value: 46,
    });
  });

  it('does not add partner C awakening bonus when the option is unchecked', () => {
    const result = calculateAwakeningGauge({
      ...baseInputs,
      considerPartnerCAwakening: false,
      partnerCAwakeningBonus: '100',
    });

    expect(result.finalPredictedGauge).toBe(0);
    expect(result.breakdown.partnerCAwakening).toEqual({
      enabled: false,
      value: 0,
    });
  });
});
