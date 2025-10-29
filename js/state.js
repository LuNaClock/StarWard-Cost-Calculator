const appState = {
    selectedPlayerChar: null,
    selectedPartnerChar: null,
    currentlySimulatingCharType: null, // 'player' or 'partner'
    redeployTarget: 'player',
    characters: [], // processed character data
};

export function getSelectedPlayerChar() {
    return appState.selectedPlayerChar;
}

export function setSelectedPlayerChar(charIndexStr) { // Renamed param for clarity
    if (charIndexStr !== null && charIndexStr !== "") {
        const index = parseInt(charIndexStr, 10);
        if (!isNaN(index) && index >= 0 && index < appState.characters.length) {
            appState.selectedPlayerChar = appState.characters[index];
            return;
        }
    }
    appState.selectedPlayerChar = null;
}

export function getSelectedPartnerChar() {
    return appState.selectedPartnerChar;
}

export function setSelectedPartnerChar(charIndexStr) { // Renamed param for clarity
    if (charIndexStr !== null && charIndexStr !== "") {
        const index = parseInt(charIndexStr, 10);
        if (!isNaN(index) && index >= 0 && index < appState.characters.length) {
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
        // console.warn("Invalid type for currentlySimulatingCharType:", type);
        appState.currentlySimulatingCharType = null; // Fallback
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
        // console.error("Invalid data provided to initializeCharacterData. Expected an array.");
        appState.characters = [];
    }
}