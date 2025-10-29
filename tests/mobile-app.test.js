import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const DEFAULT_USER_AGENT = navigator.userAgent;
const IOS_CHROMIUM_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.0.0 Mobile/15E148 Safari/604.1';
const IOS_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function setUserAgent(ua) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true
  });
}

describe('calculateRemainingTeamCost', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns a rounded remaining cost in 0.5 increments', async () => {
    const module = await import('../js/mobile-app.js');
    expect(module.calculateRemainingTeamCost(5.2, 8)).toBe(3);
  });

  it('never returns a negative value', async () => {
    const module = await import('../js/mobile-app.js');
    expect(module.calculateRemainingTeamCost(10, 8)).toBe(0);
  });

  it('handles invalid numbers gracefully', async () => {
    const module = await import('../js/mobile-app.js');
    expect(module.calculateRemainingTeamCost(Number.NaN, undefined)).toBe(0);
  });
});

describe('createCharacterAvatar', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    setUserAgent(DEFAULT_USER_AGENT);
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('forces eager loading on small avatars for iOS Chromium browsers when native lazy loading is unavailable', async () => {
    setUserAgent(IOS_CHROMIUM_UA);
    const module = await import('../js/mobile-app.js');
    vi.spyOn(module, 'hasNativeLazyLoadingSupport').mockReturnValue(false);

    const avatar = module.createCharacterAvatar({ name: 'アキ', image: 'https://example.com/a.png' }, 'small');
    const img = avatar.querySelector('img');

    expect(img.getAttribute('loading')).toBe('eager');
  });

  it('avoids setting the loading attribute on iOS Safari when native lazy loading is unavailable', async () => {
    setUserAgent(IOS_SAFARI_UA);
    const module = await import('../js/mobile-app.js');
    vi.spyOn(module, 'hasNativeLazyLoadingSupport').mockReturnValue(false);

    const avatar = module.createCharacterAvatar({ name: 'ユナ', image: 'https://example.com/b.png' }, 'small');
    const img = avatar.querySelector('img');

    expect(img.hasAttribute('loading')).toBe(false);
  });
});

describe('createScenarioListItem', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('omits consumption details for the opening step', async () => {
    const { createScenarioListItem } = await import('../js/mobile-app.js');
    const item = createScenarioListItem({
      turn: 0,
      charName: '初期HP',
      hpGained: 5000,
      remainingCost: '6.0',
      note: '開始状態'
    });

    expect(item.querySelector('.scenario-step-meta')).toBeNull();
  });

  it('adds a completion note when the remaining cost reaches zero', async () => {
    const { createScenarioListItem } = await import('../js/mobile-app.js');
    const item = createScenarioListItem({
      turn: 2,
      charName: 'テスト',
      charType: '自機',
      hpGained: 1200,
      costConsumed: 2,
      remainingCost: '0',
      note: '再出撃完了'
    });

    const notes = Array.from(item.querySelectorAll('.scenario-step-note')).map((el) => el.textContent);
    expect(notes).toContain('再出撃完了');
    expect(notes).toContain('残りコスト0の為、計算終了');
  });
});
