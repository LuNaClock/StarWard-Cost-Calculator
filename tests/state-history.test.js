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

  it('同一の自機と相方の組み合わせで役割も一致する履歴は最新のみ保持される', () => {
    const { addHistoryEntry, getHistory } = stateModule;

    const baseEntry = {
      role: 'player',
      characterId: 1,
      name: 'スター',
      playerId: 1,
      playerName: 'スター',
      partnerId: 2,
      partnerName: 'リサ',
      hp: 1000,
      timestamp: '2024-02-01T00:00:00.000Z'
    };

    expect(addHistoryEntry(baseEntry)).toBe(true);

    const updatedEntry = {
      ...baseEntry,
      hp: 1200,
      timestamp: '2024-02-01T01:00:00.000Z'
    };

    expect(addHistoryEntry(updatedEntry)).toBe(true);

    const history = getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].hp).toBe(1200);
    expect(history[0].timestamp).toBe('2024-02-01T01:00:00.000Z');
  });

  it('役割が異なる場合は同じ組み合わせでも別履歴として保持される', () => {
    const { addHistoryEntry, getHistory } = stateModule;

    const playerEntry = {
      role: 'player',
      characterId: 1,
      name: 'スター',
      playerId: 1,
      playerName: 'スター',
      partnerId: 2,
      partnerName: 'リサ',
      hp: 1000,
      timestamp: '2024-02-01T00:00:00.000Z'
    };

    const partnerEntry = {
      ...playerEntry,
      role: 'partner',
      characterId: 2,
      name: 'リサ',
      hp: 800,
      timestamp: '2024-02-01T01:00:00.000Z'
    };

    expect(addHistoryEntry(playerEntry)).toBe(true);
    expect(addHistoryEntry(partnerEntry)).toBe(true);

    const history = getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('partner');
    expect(history[1].role).toBe('player');
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
});
