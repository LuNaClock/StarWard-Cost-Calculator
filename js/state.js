const HISTORY_STORAGE_KEY = 'starward-desktop-history-v1';
const HISTORY_LIMIT = 6;

const appState = {
    selectedPlayerChar: null,
    selectedPartnerChar: null,
    currentlySimulatingCharType: null,
    redeployTarget: 'player',
    characters: [],
    history: [],
    cardScope: 'all'
};

function getHistoryKey(entry) {
    if (!entry || typeof entry !== 'object') return '';
    if (entry.characterId !== null && entry.characterId !== undefined) {
        return `id:${entry.characterId}`;
    }
    if (entry.name) {
        return `name:${entry.name}`;
    }
    return `misc:${entry.role ?? ''}:${entry.timestamp ?? ''}`;
}

function dedupeHistory(entries) {
    if (!Array.isArray(entries)) return [];
    const seen = new Set();
    const result = [];
    entries.forEach((entry) => {
        const key = getHistoryKey(entry);
        if (seen.has(key)) return;
        seen.add(key);
        result.push(entry);
    });
    return result;
}

function safePersistHistory() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(appState.history));
    } catch (error) {
        console.warn('Failed to persist history', error);
    }
}

function normalizeHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const normalized = { ...entry };
    if (!normalized.timestamp) {
        normalized.timestamp = new Date().toISOString();
    }
    return normalized;
}

export function getSelectedPlayerChar() {
    return appState.selectedPlayerChar;
}

export function setSelectedPlayerChar(charIndexStr) {
    if (charIndexStr !== null && charIndexStr !== '') {
        const index = parseInt(charIndexStr, 10);
        if (!Number.isNaN(index) && index >= 0 && index < appState.characters.length) {
            appState.selectedPlayerChar = appState.characters[index];
            return;
        }
    }
    appState.selectedPlayerChar = null;
}

export function getSelectedPartnerChar() {
    return appState.selectedPartnerChar;
}

export function setSelectedPartnerChar(charIndexStr) {
    if (charIndexStr !== null && charIndexStr !== '') {
        const index = parseInt(charIndexStr, 10);
        if (!Number.isNaN(index) && index >= 0 && index < appState.characters.length) {
            appState.selectedPartnerChar = appState.characters[index];
            return;
        }
    }
    appState.selectedPartnerChar = null;
}

export function getCurrentlySimulatingCharType() {
    return appState.currentlySimulatingCharType;
}

export function setCurrentlySimulatingCharType(type) {
    if (type === 'player' || type === 'partner' || type === null) {
        appState.currentlySimulatingCharType = type;
    } else {
        appState.currentlySimulatingCharType = null;
    }
}

export function getRedeployTarget() {
    return appState.redeployTarget;
}

export function setRedeployTarget(type) {
    if (type === 'player' || type === 'partner') {
        appState.redeployTarget = type;
    }
}

export function getCharacters() {
    return appState.characters;
}

export function initializeCharacterData(processedData) {
    if (Array.isArray(processedData)) {
        appState.characters = processedData;
    } else {
        appState.characters = [];
    }
}

export function findCharacterById(id) {
    if (typeof id !== 'number') return null;
    return appState.characters.find((char) => char.id === id) || null;
}

export function findCharacterIndexById(id) {
    if (typeof id !== 'number') return -1;
    return appState.characters.findIndex((char) => char.id === id);
}

export function findCharacterIndexByName(name) {
    if (typeof name !== 'string') return -1;
    const trimmed = name.trim();
    if (!trimmed) return -1;
    return appState.characters.findIndex((char) => char.name === trimmed);
}

export function getHistory() {
    return [...appState.history];
}

export function hasHistory() {
    return appState.history.length > 0;
}

export function setHistory(entries) {
    const normalized = Array.isArray(entries) ? dedupeHistory(entries) : [];
    appState.history = normalized.slice(0, HISTORY_LIMIT);
    safePersistHistory();
}

export function addHistoryEntry(entry) {
    const normalized = normalizeHistoryEntry(entry);
    if (!normalized) return false;

    const entryKey = getHistoryKey(normalized);
    const filtered = appState.history.filter((item) => getHistoryKey(item) !== entryKey);
    const nextHistory = [normalized, ...filtered].slice(0, HISTORY_LIMIT);

    const changed = nextHistory.length !== appState.history.length || nextHistory.some((item, index) => {
        const current = appState.history[index];
        if (!current) return true;
        return current.timestamp !== item.timestamp || current.role !== item.role || current.characterId !== item.characterId;
    });

    if (!changed) {
        return false;
    }

    appState.history = nextHistory;
    safePersistHistory();
    return true;
}

export function clearHistory() {
    if (!appState.history.length) return false;
    appState.history = [];
    safePersistHistory();
    return true;
}

export function loadHistoryFromStorage() {
    if (typeof localStorage === 'undefined') {
        appState.history = [];
        return;
    }
    try {
        const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (!saved) {
            appState.history = [];
            return;
        }
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
            appState.history = dedupeHistory(parsed).slice(0, HISTORY_LIMIT);
        } else {
            appState.history = [];
        }
    } catch (error) {
        console.warn('Failed to load history', error);
        appState.history = [];
    }
}

export function getCardScope() {
    return appState.cardScope;
}

export function setCardScope(scope) {
    const normalized = scope === 'recent' ? 'recent' : 'all';
    appState.cardScope = normalized;
}

export function getRecentCharacterIdentifiers() {
    const ids = new Set();
    const names = new Set();

    appState.history.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const { characterId, playerId, partnerId, name, playerName, partnerName } = entry;
        [characterId, playerId, partnerId].forEach((value) => {
            if (typeof value === 'number' && Number.isFinite(value)) {
                ids.add(value);
            }
        });
        [name, playerName, partnerName].forEach((value) => {
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed) {
                    names.add(trimmed);
                }
            }
        });
    });

    return { ids, names };
}
