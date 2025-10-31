import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

function createLocalStorageMock() {
  const store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      Object.keys(store).forEach((key) => delete store[key]);
    },
    key(index) {
      return Object.keys(store)[index] ?? null;
    },
    get length() {
      return Object.keys(store).length;
    },
    _store: store,
  };
}

const HISTORY_STORAGE_KEY = 'starward-desktop-history-v1';

let stateModule;

beforeEach(async () => {
  vi.resetModules();
  global.localStorage = createLocalStorageMock();
  stateModule = await import('../js/state.js');
});

afterEach(() => {
  delete global.localStorage;
});

function getStoredHistory() {
  const raw = global.localStorage.getItem(HISTORY_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('デスクトップ履歴管理', () => {
  it('履歴エントリを追加すると最新順に保持され、同一キャラも最大3件まで保存される', () => {
    const { addHistoryEntry, getHistory } = stateModule;

    const baseTime = Date.now();
    for (let i = 0; i < 3; i += 1) {
      const timestamp = new Date(baseTime + i).toISOString();
      expect(addHistoryEntry({ characterId: i, role: 'player', timestamp })).toBe(true);
    }

    expect(getHistory()).toHaveLength(3);
    expect(getHistory()[0].characterId).toBe(2);

    const additionalTimestamps = [
      new Date(baseTime + 100).toISOString(),
      new Date(baseTime + 101).toISOString(),
      new Date(baseTime + 102).toISOString()
    ];

    additionalTimestamps.forEach((timestamp, index) => {
      expect(
        addHistoryEntry({
          characterId: 3,
          role: 'player',
          timestamp,
          hp: 900 + index
        })
      ).toBe(true);
    });

    const history = getHistory();
    expect(history).toHaveLength(3);
    expect(history.slice(0, 3).map((entry) => entry.characterId)).toEqual([3, 3, 3]);
    expect(history[0].timestamp).toBe(additionalTimestamps[2]);
    expect(history.filter((entry) => entry.characterId === 3)).toHaveLength(3);

    const persisted = getStoredHistory();
    expect(persisted).not.toBeNull();
    expect(persisted).toHaveLength(3);
    expect(persisted.filter((entry) => entry.characterId === 3)).toHaveLength(3);
  });

  it('localStorageの壊れたデータを読み込む際も安全に初期化できる', () => {
    const { loadHistoryFromStorage, getHistory } = stateModule;

    global.localStorage.setItem(HISTORY_STORAGE_KEY, 'invalid-json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    loadHistoryFromStorage();

    expect(getHistory()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('履歴から最近利用したキャラクターIDや名前を重複なく取得できる', () => {
    const { setHistory, getRecentCharacterIdentifiers } = stateModule;

    setHistory([
      { characterId: 10, role: 'player', name: 'スター', timestamp: '2024-01-01T00:00:00Z' },
      { playerId: 2, playerName: 'アルト', partnerId: 3, partnerName: 'リサ', timestamp: '2024-01-02T00:00:00Z' },
      { characterId: 10, role: 'partner', partnerName: ' リサ ', timestamp: '2024-01-03T00:00:00Z' },
      { name: 'スター', timestamp: '2024-01-04T00:00:00Z' },
    ]);

    const { ids, names } = getRecentCharacterIdentifiers();

    expect(ids.has(10)).toBe(true);
    expect(ids.has(2)).toBe(true);
    expect(ids.has(3)).toBe(true);
    expect(names.has('スター')).toBe(true);
    expect(names.has('リサ')).toBe(true);
    expect(names.has('アルト')).toBe(true);
    expect(names.size).toBe(3);
  });

  it('同一の自機・相方組み合わせは最新の1件に統合される', () => {
    const { addHistoryEntry, getHistory } = stateModule;

    const baseTime = Date.now();
    const firstEntry = {
      role: 'player',
      characterId: 1,
      playerId: 1,
      playerName: 'カリン',
      partnerId: 2,
      partnerName: 'ユイ',
      hp: 800,
      timestamp: new Date(baseTime).toISOString(),
    };

    const secondEntry = {
      role: 'partner',
      characterId: 2,
      playerId: 1,
      playerName: 'カリン',
      partnerId: 2,
      partnerName: 'ユイ',
      hp: 920,
      timestamp: new Date(baseTime + 1000).toISOString(),
    };

    expect(addHistoryEntry(firstEntry)).toBe(true);
    expect(addHistoryEntry(secondEntry)).toBe(true);

    const history = getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].hp).toBe(920);
    expect(history[0].role).toBe('partner');
  });
});
