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
  it('履歴エントリを追加すると最新が先頭に保持され重複が排除される', () => {
    const { addHistoryEntry, getHistory } = stateModule;

    const baseTime = Date.now();
    for (let i = 0; i < 6; i += 1) {
      const timestamp = new Date(baseTime + i).toISOString();
      expect(addHistoryEntry({ characterId: i, role: 'player', timestamp })).toBe(true);
    }

    expect(getHistory()).toHaveLength(6);
    expect(getHistory()[0].characterId).toBe(5);

    const replacementTimestamp = new Date(baseTime + 100).toISOString();
    expect(addHistoryEntry({ characterId: 3, role: 'player', timestamp: replacementTimestamp })).toBe(true);

    const history = getHistory();
    expect(history).toHaveLength(6);
    expect(history[0].characterId).toBe(3);
    expect(history[0].timestamp).toBe(replacementTimestamp);
    expect(history.filter((entry) => entry.characterId === 3)).toHaveLength(1);

    const persisted = getStoredHistory();
    expect(persisted).not.toBeNull();
    expect(persisted).toHaveLength(6);
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
