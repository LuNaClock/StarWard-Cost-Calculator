import * as State from './state.js';
import * as DOM from './domElements.js';
import { getCharacters } from './state.js';
import { processSimulateRedeploy, processAwakeningGaugeCalculation, processTeamHpCombinations } from './app.js';
import * as UI from './ui.js';
import { MAX_TEAM_COST } from '../data.js';

const BASE_URL = window.location.origin + window.location.pathname;

export function generateShareUrlForRedeploy() {
    const simCharType = State.getCurrentlySimulatingCharType();

    const params = new URLSearchParams();
    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    const characters = getCharacters();

    if (!characters || characters.length === 0) return `${BASE_URL}?error=no_chars_loaded`;

    if (playerChar) {
        const playerIndex = characters.findIndex(c => c.name === playerChar.name);
        if (playerIndex > -1) params.set('p', playerIndex.toString());
    }
    if (partnerChar) {
        const partnerIndex = characters.findIndex(c => c.name === partnerChar.name);
        if (partnerIndex > -1) params.set('pt', partnerIndex.toString());
    }
    
    params.set('rc', DOM.remainingTeamCostInput.value);
    
    if (simCharType) {
        params.set('sim', simCharType);
    } else {
        // console.warn("generateShareUrlForRedeploy: currentlySimulatingCharType is null when trying to generate share URL.");
    }

    let hasAwakeningParams = false;
    const agValue = DOM.beforeShotdownAwakeningGaugeInput.value;
    const ahValue = DOM.beforeShotdownHpInput.value;

    if (agValue !== "0") {
        params.set('ag', agValue);
        hasAwakeningParams = true;
    }
    
    if (ahValue !== "0") {
        params.set('ah', ahValue);
        hasAwakeningParams = true;
    } else if (hasAwakeningParams && ahValue === "0") { // If 'ag' is set, and 'ah' is explicitly "0"
         params.set('ah', "0");
    }


    if (DOM.considerOwnDownCheckbox.checked) {
        params.set('od', '1');
        hasAwakeningParams = true;
    }
    if (DOM.considerDamageDealtCheckbox.checked) {
        params.set('dd', '1');
        hasAwakeningParams = true;
        if (DOM.damageDealtAwakeningBonusSelect.value !== "0") {
            params.set('ddb', DOM.damageDealtAwakeningBonusSelect.value);
        }
    }
    if (DOM.considerShieldSuccessCheckbox && DOM.considerShieldSuccessCheckbox.checked) {
        params.set('ss', '1');
        hasAwakeningParams = true;
        if (DOM.shieldSuccessAwakeningBonusSelect && DOM.shieldSuccessAwakeningBonusSelect.value !== "0") {
            params.set('ssb', DOM.shieldSuccessAwakeningBonusSelect.value);
        }
    }
    if (DOM.considerPartnerDownCheckbox.checked) {
        params.set('pd', '1');
        hasAwakeningParams = true;
    }

    if (hasAwakeningParams && simCharType) {
        params.set('anchor', 'awakening');
    }
    
    return `${BASE_URL}?${params.toString()}`;
}

export function generateShareUrlForTotalHp() {
    const params = new URLSearchParams();
    const playerChar = State.getSelectedPlayerChar();
    const partnerChar = State.getSelectedPartnerChar();
    const characters = getCharacters();

    if (!characters || characters.length === 0) return `${BASE_URL}?error=no_chars_loaded`;

    if (playerChar) {
        const playerIndex = characters.findIndex(c => c.name === playerChar.name);
        if (playerIndex > -1) params.set('p', playerIndex.toString());
    }
    if (partnerChar) {
        const partnerIndex = characters.findIndex(c => c.name === partnerChar.name);
        if (partnerIndex > -1) params.set('pt', partnerIndex.toString());
    }
    params.set('view', 'totalhp'); 
    params.set('anchor', 'totalhp_area');

    return `${BASE_URL}?${params.toString()}`;
}

function isValidCostValue(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= MAX_TEAM_COST && (num * 10) % 5 === 0; // 0.5刻み
}

function isValidGaugeValue(value) {
    const num = parseInt(value, 10);
    return !isNaN(num) && num >= 0 && num <= 100;
}

function isValidHpValue(value, maxHp) {
    const num = parseInt(value, 10);
    return !isNaN(num) && num >= 0 && (maxHp === undefined || num <= maxHp);
}

export function parseUrlAndRestoreState() {
    const params = new URLSearchParams(window.location.search);
    const characters = getCharacters(); 

    if (!characters || characters.length === 0) {
        // console.warn("Characters not loaded when parseUrlAndRestoreState was called. State restoration might be incomplete.");
        return;
    }

    const playerIndexStr = params.get('p');
    const partnerIndexStr = params.get('pt');

    if (playerIndexStr !== null) {
        const playerIndex = parseInt(playerIndexStr, 10);
        if (!isNaN(playerIndex) && playerIndex >= 0 && playerIndex < characters.length) {
            DOM.playerCharSelect.value = playerIndexStr; 
            State.setSelectedPlayerChar(playerIndexStr); 
        } else {
            // console.warn("Invalid player index from URL:", playerIndexStr);
        }
    }
    if (partnerIndexStr !== null) {
        const partnerIndex = parseInt(partnerIndexStr, 10);
        if (!isNaN(partnerIndex) && partnerIndex >= 0 && partnerIndex < characters.length) {
            DOM.partnerCharSelect.value = partnerIndexStr;
            State.setSelectedPartnerChar(partnerIndexStr);
        } else {
            // console.warn("Invalid partner index from URL:", partnerIndexStr);
        }
    }

    UI.syncCharacterPickerSelection('player');
    UI.syncCharacterPickerSelection('partner');

    UI.updateTeamCostDisplay(MAX_TEAM_COST);
    UI.updateSelectedCharactersDisplay();

    const playerChar = State.getSelectedPlayerChar(); // Get selected char for max HP validation
    const partnerChar = State.getSelectedPartnerChar(); // Get selected char for max HP validation


    if (params.has('rc')) {
        const rcValue = params.get('rc');
        if (isValidCostValue(rcValue)) {
            DOM.remainingTeamCostInput.value = rcValue;
        } else {
            // console.warn("Invalid 'rc' (remaining cost) parameter from URL:", rcValue);
            // Fallback to default or auto-calculated value is handled by updateTeamCostDisplay
        }
    }

    if (params.has('ag')) {
        const agValue = params.get('ag');
        if (isValidGaugeValue(agValue) && DOM.beforeShotdownAwakeningGaugeInput) {
            DOM.beforeShotdownAwakeningGaugeInput.value = agValue;
        } else {
            // console.warn("Invalid 'ag' (awakening gauge) parameter from URL or element not found:", agValue);
            if (DOM.beforeShotdownAwakeningGaugeInput) DOM.beforeShotdownAwakeningGaugeInput.value = '';
        }
    } else if (DOM.beforeShotdownAwakeningGaugeInput) {
        DOM.beforeShotdownAwakeningGaugeInput.value = '';
    }
    
    const simTypeForHpValidation = params.get('sim');
    let maxHpForAhValidation;
    if (simTypeForHpValidation === 'player' && playerChar) {
        maxHpForAhValidation = playerChar.hp;
    } else if (simTypeForHpValidation === 'partner' && partnerChar) {
        maxHpForAhValidation = partnerChar.hp;
    } // else, maxHpForAhValidation remains undefined, so isValidHpValue won't check max range.

    if (params.has('ah')) {
        const ahValue = params.get('ah');
        if (isValidHpValue(ahValue, maxHpForAhValidation) && DOM.beforeShotdownHpInput) {
            DOM.beforeShotdownHpInput.value = ahValue;
        } else {
            // console.warn("Invalid 'ah' (awakening HP/damage taken) parameter from URL or element not found:", ahValue);
            if (DOM.beforeShotdownHpInput) DOM.beforeShotdownHpInput.value = '';
        }
    } else if (DOM.beforeShotdownHpInput) {
        DOM.beforeShotdownHpInput.value = '';
    }
    
    if (DOM.considerOwnDownCheckbox) {
        DOM.considerOwnDownCheckbox.checked = params.get('od') === '1';
    }

    const ddParam = params.get('dd');
    if (DOM.considerDamageDealtCheckbox) {
        DOM.considerDamageDealtCheckbox.checked = ddParam === '1';
        if (DOM.considerDamageDealtCheckbox.checked) {
            if (DOM.damageDealtOptionsContainer) DOM.damageDealtOptionsContainer.style.display = 'block';
            if (params.has('ddb') && DOM.damageDealtAwakeningBonusSelect) {
                const ddbValue = params.get('ddb');
                const isValidDdb = Array.from(DOM.damageDealtAwakeningBonusSelect.options).some(opt => opt.value === ddbValue);
                if (isValidDdb) {
                     DOM.damageDealtAwakeningBonusSelect.value = ddbValue;
                } else {
                    // console.warn("Invalid 'ddb' (damage dealt bonus) parameter from URL:", ddbValue);
                    DOM.damageDealtAwakeningBonusSelect.value = "0";
                }
            }
        } else {
            if (DOM.damageDealtOptionsContainer) DOM.damageDealtOptionsContainer.style.display = 'none';
            if (DOM.damageDealtAwakeningBonusSelect) DOM.damageDealtAwakeningBonusSelect.value = "0";
        }
    }

    const ssParam = params.get('ss');
    if (DOM.considerShieldSuccessCheckbox) {
        DOM.considerShieldSuccessCheckbox.checked = ssParam === '1';
        if (DOM.considerShieldSuccessCheckbox.checked) {
            if (DOM.shieldSuccessOptionsContainer) DOM.shieldSuccessOptionsContainer.style.display = 'block';
            if (params.has('ssb') && DOM.shieldSuccessAwakeningBonusSelect) {
                const ssbValue = params.get('ssb');
                const isValidSsb = Array.from(DOM.shieldSuccessAwakeningBonusSelect.options).some(opt => opt.value === ssbValue);
                if (isValidSsb) {
                    DOM.shieldSuccessAwakeningBonusSelect.value = ssbValue;
                } else {
                    DOM.shieldSuccessAwakeningBonusSelect.value = "0";
                }
            }
        } else {
            if (DOM.shieldSuccessOptionsContainer) DOM.shieldSuccessOptionsContainer.style.display = 'none';
            if (DOM.shieldSuccessAwakeningBonusSelect) DOM.shieldSuccessAwakeningBonusSelect.value = "0";
        }
    }

    if (DOM.considerPartnerDownCheckbox) {
        DOM.considerPartnerDownCheckbox.checked = params.get('pd') === '1';
    }

    const simTypeFromUrl = params.get('sim');
    const viewTypeFromUrl = params.get('view');
    const anchorTo = params.get('anchor');
    const allowedSimTypes = ['player', 'partner'];
    const allowedViewTypes = ['totalhp'];
    const allowedAnchors = ['awakening', 'totalhp_area'];

    let simulationRan = false;

    if (simTypeFromUrl && allowedSimTypes.includes(simTypeFromUrl) && playerChar && partnerChar) {
        State.setCurrentlySimulatingCharType(simTypeFromUrl); 
        processSimulateRedeploy(simTypeFromUrl);
        simulationRan = true; 
        if (anchorTo && allowedAnchors.includes(anchorTo) && anchorTo === 'awakening' && DOM.awakeningSimulationArea) {
            setTimeout(() => {
                if (DOM.awakeningSimulationArea.offsetParent !== null) { // Check if visible
                    DOM.awakeningSimulationArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300); 
        }
    } else if (viewTypeFromUrl && allowedViewTypes.includes(viewTypeFromUrl) && viewTypeFromUrl === 'totalhp' && playerChar && partnerChar) {
        processTeamHpCombinations();
        simulationRan = true;
        if (anchorTo && allowedAnchors.includes(anchorTo) && anchorTo === 'totalhp_area' && DOM.totalHpDisplayArea && DOM.totalHpDisplayArea.classList.contains('active')) {
            setTimeout(() => {
                 if (DOM.totalHpDisplayArea.offsetParent !== null) { // Check if visible
                    DOM.totalHpDisplayArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
            }, 100);
        }
    } else if (playerChar && partnerChar) { 
        processTeamHpCombinations();
        simulationRan = true; 
        if(params.has('ag') || params.has('ah') || params.has('od') || params.has('dd') || params.has('ddb') || params.has('ss') || params.has('ssb') || params.has('pd')) {
            if (!simTypeFromUrl || !allowedSimTypes.includes(simTypeFromUrl)) {
                // console.warn("Awakening parameters found in URL, but 'sim' parameter is missing or invalid. Awakening simulation will not run automatically for specific character.");
            }
        }
    }
    
    if (!simulationRan) {
        UI.resetSimulationResultsUI();
        UI.displayTotalTeamHpResults(null); 
    }
}

export async function copyUrlToClipboard(textToCopy, buttonElement) {
    if (!navigator.clipboard) {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            // Prevent visual disruption and ensure it's selectable
            textArea.style.position = "fixed"; 
            textArea.style.top = "-9999px";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful && buttonElement) {
                const originalHTML = buttonElement.innerHTML; // Store full HTML for icon
                buttonElement.innerHTML = '<i class="fas fa-check"></i> コピー完了!';
                buttonElement.disabled = true;
                setTimeout(() => {
                    buttonElement.innerHTML = originalHTML;
                    buttonElement.disabled = false;
                }, 2000);
            } else {
                alert('URLのコピーに失敗しました。手動でコピーしてください。');
                // console.error('Fallback: クリップボードへのコピーに失敗しました。');
            }
        } catch (err) {
            alert('URLのコピーに失敗しました。手動でコピーしてください。');
            // console.error('Fallback: クリップボードへのコピー中にエラーが発生しました:', err);
        }
        return;
    }

    try {
        await navigator.clipboard.writeText(textToCopy);
        if (buttonElement) {
            const originalHTML = buttonElement.innerHTML; // Store full HTML for icon
            buttonElement.innerHTML = '<i class="fas fa-check"></i> コピー完了!';
            buttonElement.disabled = true;
            setTimeout(() => {
                buttonElement.innerHTML = originalHTML;
                buttonElement.disabled = false;
            }, 2000);
        }
    } catch (err) {
        // console.error('クリップボードへのコピーに失敗しました:', err);
        alert('URLのコピーに失敗しました。手動でコピーしてください。');
    }
}