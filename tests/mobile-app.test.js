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
    expect(notes).toEqual(['残りコスト0の為、計算終了']);
  });
});

describe('collectRecentCharacterIdentifiers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('収集したIDと名前に自機・相方の両方を含める', async () => {
    const { collectRecentCharacterIdentifiers } = await import('../js/mobile-app.js');
    const history = [
      {
        characterId: 1,
        name: 'メイン機',
        playerId: 10,
        playerName: '自機A',
        partnerId: 20,
        partnerName: '相方B'
      },
      {
        characterId: null,
        name: '  ',
        playerId: 30,
        playerName: ' 自機C ',
        partnerId: undefined,
        partnerName: ' 相方D '
      },
      null
    ];

    const { ids, names } = collectRecentCharacterIdentifiers(history);

    expect(ids).toBeInstanceOf(Set);
    expect(names).toBeInstanceOf(Set);
    expect(ids.size).toBe(4);
    expect(Array.from(ids)).toEqual(expect.arrayContaining([1, 10, 20, 30]));
    expect(names.size).toBe(5);
    expect(names.has('メイン機')).toBe(true);
    expect(names.has('自機A')).toBe(true);
    expect(names.has('相方B')).toBe(true);
    expect(names.has('自機C')).toBe(true);
    expect(names.has('相方D')).toBe(true);
    expect(names.has('')).toBe(false);
  });

  it('重複や不正値を適切に除外しつつ識別子を集約する', async () => {
    const { collectRecentCharacterIdentifiers } = await import('../js/mobile-app.js');
    const history = [
      {
        characterId: 5,
        playerId: 5,
        partnerId: 6,
        name: 'セイ',
        playerName: '自機セイ',
        partnerName: '相方ロイ'
      },
      {
        characterId: 5,
        playerId: 7,
        partnerId: 6,
        name: 'セイ',
        playerName: '自機ヒロ',
        partnerName: '相方ロイ'
      },
      {
        characterId: Number.POSITIVE_INFINITY,
        playerId: Number.NaN,
        partnerId: Number.NEGATIVE_INFINITY,
        name: '',
        playerName: '   ',
        partnerName: null
      }
    ];

    const { ids, names } = collectRecentCharacterIdentifiers(history);

    expect(Array.from(ids)).toEqual(expect.arrayContaining([5, 6, 7]));
    expect(ids.size).toBe(3);
    expect(Array.from(names)).toEqual(expect.arrayContaining(['セイ', '自機セイ', '相方ロイ', '自機ヒロ']));
    expect(names.size).toBe(4);
  });

  it('不正な履歴データを渡した場合でも空集合を返す', async () => {
    const { collectRecentCharacterIdentifiers } = await import('../js/mobile-app.js');
    const { ids, names } = collectRecentCharacterIdentifiers(undefined);

    expect(ids.size).toBe(0);
    expect(names.size).toBe(0);
  });
});
