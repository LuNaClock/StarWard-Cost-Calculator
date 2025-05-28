// characterDataは rawCharacterData をもとに app.js で加工されてからセットされる想定
const appState = {
    selectedPlayerChar: null,
    selectedPartnerChar: null,
    currentlySimulatingCharType: null, // 'player' or 'partner'
    characters: [], // processed character data
};

export function getSelectedPlayerChar() {
    return appState.selectedPlayerChar;
}

export function setSelectedPlayerChar(charIndex) {
    appState.selectedPlayerChar = charIndex !== null && charIndex !== "" ? appState.characters[parseInt(charIndex)] : null;
}

export function getSelectedPartnerChar() {
    return appState.selectedPartnerChar;
}

export function setSelectedPartnerChar(charIndex) {
    appState.selectedPartnerChar = charIndex !== null && charIndex !== "" ? appState.characters[parseInt(charIndex)] : null;
}

export function getCurrentlySimulatingCharType() {
    return appState.currentlySimulatingCharType;
}

export function setCurrentlySimulatingCharType(type) {
    appState.currentlySimulatingCharType = type;
}

export function getCharacters() {
    return appState.characters;
}

// 初期キャラクターデータをステートに設定する関数 (app.js で呼び出す)
export function initializeCharacterData(processedData) {
    appState.characters = processedData;
}