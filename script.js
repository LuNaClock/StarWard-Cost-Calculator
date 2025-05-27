import { rawCharacterData, kanjiNameReadings, costRemainingMap, MAX_TEAM_COST, AVERAGE_GAUGE_COEFFICIENT, AWAKENING_THRESHOLD, AWAKENING_BONUS_BY_COST, PARTNER_DOWN_AWAKENING_BONUS } from './data.js';

// Helper functions for Hiragana/Katakana conversion
function toHiragana(str) {
    if (!str) return "";
    return str.replace(/[\u30A1-\u30F6]/g, function(match) { // Katakana to Hiragana
        var chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
}

function toKatakana(str) {
    if (!str) return "";
    return str.replace(/[\u3041-\u3096]/g, function(match) { // Hiragana to Katakana
        var chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });
}

const characterData = rawCharacterData.map(char => {
    let yomi_hiragana, yomi_katakana;
    if (kanjiNameReadings[char.name]) {
        yomi_hiragana = kanjiNameReadings[char.name].hiragana;
        yomi_katakana = kanjiNameReadings[char.name].katakana;
    } else {
        yomi_hiragana = toHiragana(char.name);
        yomi_katakana = toKatakana(char.name);
    }
    return {
        ...char,
        yomi_hiragana,
        yomi_katakana
    };
});


let selectedPlayerChar = null;
let selectedPartnerChar = null;
let currentlySimulatingCharType = null;

let characterGrid, characterSearchInput, searchIcon, costFilterButtons, sortFilterButtons, accordionHeaders, loadingOverlay;
let playerCharSelect, partnerCharSelect, totalTeamCostSpan, selectedCharsDisplay, remainingTeamCostInput;
let simulatePlayerRedeployBtn, simulatePartnerRedeployBtn, simulationResultsDiv;
let redeployCharNameSpan, redeployCharCostSpan, redeployOriginalHpSpan, redeployCostConsumedSpan, redeployCalculatedHpSpan;
let simulationHpBarFill, simulationHpPercentageDisplay;
let totalHpDisplayArea; // Re-declare totalHpDisplayArea
let highestHpScenarioTitleSpan, idealGainedHpSpan, idealSequenceList; // Re-declare these
let compromiseHpScenarioTitleSpan, minGainedHpHpSpan, minSequenceList;
let lowestHpScenarioTitleSpan, lowestGainedHpSpan, lowestSequenceList;
let bombHpScenarioTitleSpan, bombGainedHpSpan, bombSequenceList;
let selectedPlayerCharNameSummary, selectedPartnerCharNameSummary;
let beforeShotdownAwakeningGaugeInput, beforeShotdownHpInput_damageTakenInput;
let predictedAwakeningGaugeSpan, awakeningAvailabilitySpan;
let considerOwnDownCheckbox, considerDamageDealtCheckbox, damageDealtOptionsContainer, damageDealtAwakeningBonusSelect;
let considerPartnerDownCheckbox;

// ★新しいセレクタの追加★
let subAccordionHeaders;


function showLoading() {
    if (loadingOverlay) loadingOverlay.classList.add('active');
}
function hideLoading() {
    if (loadingOverlay) gsap.to(loadingOverlay, { opacity: 0, duration: 0.3, onComplete: () => loadingOverlay.classList.remove('active') });
}

function generateCharacterCards(characters) {
    showLoading();
    gsap.to(Array.from(characterGrid.children), {
        opacity: 0, scale: 0.8, y: 50, duration: 0.2, stagger: 0.01, ease: "power2.in", overwrite: true,
        onComplete: () => {
            characterGrid.innerHTML = '';
            if (characters.length === 0) {
                const noResultsMessage = document.createElement('p');
                noResultsMessage.className = 'no-results-message';
                noResultsMessage.textContent = 'ERROR: NO DATA FOUND';
                characterGrid.appendChild(noResultsMessage);
                gsap.fromTo(noResultsMessage, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out", delay: 0.1, animation: 'glitchDisplay 2s ease-in-out forwards', overwrite: true });
                hideLoading();
                return;
            }
            characters.forEach((character, index) => {
                const card = document.createElement('div');
                card.className = 'character-card';
                card.dataset.originalHp = character.hp;

                const applicableRemainingCosts = costRemainingMap[character.cost.toFixed(1)] || [];
                const costOverHPs = applicableRemainingCosts.map(remainingCost => {
                    let calculatedHpForDisplay;
                    if (character.cost <= 0) calculatedHpForDisplay = 0;
                    else if (remainingCost >= character.cost) calculatedHpForDisplay = character.hp;
                    else if (remainingCost > 0) calculatedHpForDisplay = Math.round(character.hp * (remainingCost / character.cost));
                    else calculatedHpForDisplay = 0;
                    return calculatedHpForDisplay;
                });
                card.innerHTML = `
                    <div class="character-header"><span>${character.name}</span><span class="character-cost">コスト: ${character.cost.toFixed(1)}</span></div>
                    <div class="character-body">
                        <div class="character-image"><img src="" alt="${character.name}" class="character-icon-img"><span class="initial">${character.name.charAt(0)}</span></div>
                        <div class="character-stats"><span>本来の耐久値:</span><span class="character-hp">${character.hp.toLocaleString()}</span></div>
                        <div class="hp-bar-container"><div class="hp-bar-fill"></div></div><div class="hp-percentage-display"></div>
                        <table class="cost-table">
                            <thead><tr><th>残りコスト</th>${applicableRemainingCosts.map(cost => `<th>${cost.toFixed(1)}</th>`).join('')}</tr></thead>
                            <tbody><tr><td>再出撃時耐久値</td>${costOverHPs.map((hp, idx) => `<td data-redeploy-hp="${hp}">${hp.toLocaleString()}</td>`).join('')}</tr></tbody>
                        </table>
                    </div>`;
                characterGrid.appendChild(card);
                const imgElement = card.querySelector('.character-icon-img');
                const initialSpan = card.querySelector('.initial');
                if (character.image) {
                    imgElement.onload = () => { imgElement.style.display = 'block'; initialSpan.style.display = 'none'; };
                    imgElement.onerror = () => { imgElement.style.display = 'none'; initialSpan.style.display = 'flex'; };
                    imgElement.src = character.image;
                     if (imgElement.complete && imgElement.naturalWidth > 0) {
                        imgElement.style.display = 'block'; initialSpan.style.display = 'none';
                    }
                } else { imgElement.style.display = 'none'; initialSpan.style.display = 'flex'; }
                gsap.from(card, { opacity: 0, y: 80, scale: 0.8, rotateZ: gsap.utils.random(-5, 5), duration: 0.4, ease: "power3.out", delay: index * 0.02, overwrite: true });
            });
            hideLoading();
        }
    });
}

function applyFiltersAndSearch() {
    const searchTermInputVal = characterSearchInput.value.trim();
    const inputRawLower = searchTermInputVal.toLowerCase();
    const inputHiragana = toHiragana(inputRawLower);
    const inputKatakana = toKatakana(inputRawLower);

    const activeCostFilter = document.querySelector('#costFilter .active').dataset.cost;
    const activeSortFilter = document.querySelector('#sortFilter .active').dataset.sort;
    let filteredCharacters = [...characterData];

    if (searchTermInputVal) {
        filteredCharacters = filteredCharacters.filter(c => {
            const nameLower = c.name.toLowerCase();
            const yomiHiraLower = c.yomi_hiragana.toLowerCase();
            const yomiKataLower = c.yomi_katakana.toLowerCase();
            return nameLower.includes(inputRawLower) || nameLower.includes(inputHiragana) || nameLower.includes(inputKatakana) ||
                   yomiHiraLower.includes(inputRawLower) || yomiHiraLower.includes(inputHiragana) || yomiHiraLower.includes(inputKatakana) ||
                   yomiKataLower.includes(inputRawLower) || yomiKataLower.includes(inputHiragana) || yomiKataLower.includes(inputKatakana);
        });
    }
    if (activeCostFilter !== 'all') {
        filteredCharacters = filteredCharacters.filter(c => c.cost.toString() === activeCostFilter);
    }
    switch (activeSortFilter) {
        case 'name': filteredCharacters.sort((a, b) => a.name.localeCompare(b.name, 'ja')); break;
        // ユーザーの直感に合わせてソートロジックを調整
        case 'hp-asc': filteredCharacters.sort((a, b) => a.hp - b.hp || a.name.localeCompare(b.name, 'ja')); break; // 耐久値 ↓ (低耐久値から)
        case 'hp-desc': filteredCharacters.sort((a, b) => b.hp - a.hp || a.name.localeCompare(b.name, 'ja')); break; // 耐久値 ↑ (高耐久値から)
        case 'cost-asc': filteredCharacters.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'ja')); break; // コスト ↓ (低コストから)
        case 'cost-desc': filteredCharacters.sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, 'ja')); break; // コスト ↑ (高コストから)
    }
    generateCharacterCards(filteredCharacters);
}

function animateHpDisplay(card, targetHp) {
    const hpBarFill = card.querySelector('.hp-bar-fill');
    const originalHp = parseFloat(card.dataset.originalHp);
    const currentHpSpan = card.querySelector('.character-hp');
    const hpPercentageDisplayElement = card.querySelector('.hp-percentage-display');
    const allRedeployCellsInCard = card.querySelectorAll('.cost-table td[data-redeploy-hp]');
    gsap.killTweensOf(currentHpSpan);
    gsap.set(currentHpSpan, { color: '#E74C3C', textShadow: '0 0 5px rgba(231, 76, 60, 0.3)' });
    currentHpSpan.textContent = originalHp.toLocaleString();
    currentHpSpan.classList.remove('animating');
    gsap.killTweensOf(hpBarFill);
    if (targetHp === originalHp) {
        gsap.to(hpBarFill, { scaleX: 1, duration: 0.8, ease: "power3.out", transformOrigin: 'left center', overwrite: true });
        hpBarFill.classList.remove('hp-bar-low-pulse');
        allRedeployCellsInCard.forEach(cell => cell.classList.remove('active-hp-display'));
        currentHpSpan.classList.add('animating');
        gsap.delayedCall(0.8, () => currentHpSpan.classList.remove('animating'));
        if (hpPercentageDisplayElement) { hpPercentageDisplayElement.textContent = '100%'; hpPercentageDisplayElement.classList.add('show'); }
    } else {
        const hpPercentage = (originalHp > 0 ? (targetHp / originalHp) : 0);
        gsap.to(hpBarFill, {
            scaleX: hpPercentage, duration: 0.8, ease: "power3.out", transformOrigin: 'left center', overwrite: true,
            onUpdate: () => { if (hpPercentageDisplayElement) hpPercentageDisplayElement.textContent = `${Math.round(gsap.getProperty(hpBarFill, "scaleX") * 100)}%`; },
            onComplete: () => { if (hpPercentageDisplayElement) hpPercentageDisplayElement.textContent = `${Math.round(hpPercentage * 100)}%`; }
        });
        if (hpPercentage <= 0.3) hpBarFill.classList.add('hp-bar-low-pulse'); else hpBarFill.classList.remove('hp-bar-low-pulse');
        currentHpSpan.classList.add('animating');
        gsap.delayedCall(0.8, () => currentHpSpan.classList.remove('animating'));
        if (hpPercentageDisplayElement) {
            hpPercentageDisplayElement.classList.add('show');
            hpPercentageDisplayElement.textContent = `${Math.round(parseFloat(gsap.getProperty(hpBarFill, "scaleX")) * 100)}%`;
        }
        allRedeployCellsInCard.forEach(cell => cell.classList.remove('active-hp-display'));
        const clickedCell = Array.from(allRedeployCellsInCard).find(cell => parseFloat(cell.dataset.redeployHp) === targetHp);
        if (clickedCell) clickedCell.classList.add('active-hp-display');
    }
}

let searchIconPulseTl;
function initSearchIconPulseAnimation() {
    searchIconPulseTl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 1.8, ease: "power2.inOut", overwrite: true } });
    if (searchIcon) searchIconPulseTl.to(searchIcon, { scale: 1.08, opacity: 1 });
}

// updateSortIcons 関数はHTMLで直接アイコンを記述するため削除します。
// function updateSortIcons() {
//      sortFilterButtons.forEach(button => {
//         const existingIcon = button.querySelector('i'); if (existingIcon) existingIcon.remove();
//         const sortType = button.dataset.sort; let iconClass = '';
//         if (sortType.includes('desc')) iconClass = 'fas fa-arrow-down';
//         else if (sortType.includes('asc')) iconClass = 'fas fa-arrow-up';
//         if (iconClass) {
//             const newIcon = document.createElement('i'); newIcon.className = iconClass;
//             if (button.classList.contains('active') && !button.hasAttribute('data-initial-sort-applied')) {
//                 button.appendChild(newIcon); button.setAttribute('data-initial-sort-applied', 'true');
//             } else { button.appendChild(newIcon); }
//         }
//     });
// }

function populateCharacterSelects() {
    const defaultOption = '<option value="">-- 選択してください --</option>';
    playerCharSelect.innerHTML = defaultOption; partnerCharSelect.innerHTML = defaultOption;
    characterData.forEach((char, index) => {
        const option = `<option value="${index}">${char.name} (コスト:${char.cost.toFixed(1)})</option>`;
        playerCharSelect.innerHTML += option; partnerCharSelect.innerHTML += option;
    });
}

function populateRemainingCostSelect() {
    remainingTeamCostInput.innerHTML = '';
    const zeroOption = document.createElement('option'); zeroOption.value = "0.0"; zeroOption.textContent = "0.0";
    remainingTeamCostInput.appendChild(zeroOption);
    for (let cost = 0.5; cost <= MAX_TEAM_COST; cost += 0.5) {
        const option = document.createElement('option'); option.value = cost.toFixed(1); option.textContent = cost.toFixed(1);
        remainingTeamCostInput.appendChild(option);
    }
}

function updateSelectedCharactersDisplay() {
    selectedCharsDisplay.innerHTML = '';
    const createMiniCard = (character) => {
        const miniCard = document.createElement('div'); miniCard.className = 'mini-character-card active';
        miniCard.innerHTML = `
            <div class="char-name">${character.name}</div>
            <div class="char-image">
                <img src="${character.image || ''}" alt="${character.name}" class="mini-char-img" style="display: ${character.image ? 'block' : 'none'};">
                <span class="initial" style="display: ${character.image ? 'none' : 'flex'};">${character.name.charAt(0)}</span>
            </div>
            <div class="char-cost">コスト: ${character.cost.toFixed(1)}</div>`;
        const imgElement = miniCard.querySelector('.mini-char-img'); const initialSpan = miniCard.querySelector('.initial');
        if (character.image && imgElement) {
            imgElement.onload = () => { imgElement.style.display = 'block'; if(initialSpan) initialSpan.style.display = 'none'; };
            imgElement.onerror = () => { if(imgElement) imgElement.style.display = 'none'; if(initialSpan) initialSpan.style.display = 'flex'; };
            imgElement.src = character.image;
            if (imgElement.complete && imgElement.naturalWidth > 0) { imgElement.style.display = 'block'; if(initialSpan) initialSpan.style.display = 'none';}
        } else if (initialSpan) { if(imgElement) imgElement.style.display = 'none'; initialSpan.style.display = 'flex';}
        return miniCard;
    };
    if (selectedPlayerChar) selectedCharsDisplay.appendChild(createMiniCard(selectedPlayerChar));
    if (selectedPartnerChar) selectedCharsDisplay.appendChild(createMiniCard(selectedPartnerChar));
    if (!selectedPlayerChar && !selectedPartnerChar) {
        selectedCharsDisplay.innerHTML = `<p style="color:var(--medium-grey); font-style:italic; margin-top:20px;">自機と相方を選択してください。</p>`;
        gsap.set(selectedCharsDisplay, { minHeight: '80px', display: 'flex', alignItems: 'center' });
    } else {
        gsap.set(selectedCharsDisplay, { minHeight: '180px' });
    }
}

function updateTeamCost() {
    const playerCost = selectedPlayerChar ? selectedPlayerChar.cost : 0;
    const partnerCost = selectedPartnerChar ? selectedPartnerChar.cost : 0;
    const currentTotalTeamCost = playerCost + partnerCost;
    totalTeamCostSpan.textContent = currentTotalTeamCost.toFixed(1);
    let autoCalculatedRemainingCost = MAX_TEAM_COST - currentTotalTeamCost;
    autoCalculatedRemainingCost = Math.max(0.0, Math.round(autoCalculatedRemainingCost * 2) / 2);
    const targetValue = autoCalculatedRemainingCost.toFixed(1);
    if (Array.from(remainingTeamCostInput.options).some(opt => opt.value === targetValue)) {
        remainingTeamCostInput.value = targetValue;
    } else { remainingTeamCostInput.value = "0.0"; }
    resetSimulationResults();
    findTeamHpCombinations();
}

function resetSimulationResults() {
    gsap.to(simulationResultsDiv, {
        opacity: 0, y: 20, duration: 0.3, ease: "power2.in",
        onComplete: () => {
            if (simulationResultsDiv) simulationResultsDiv.classList.remove('active');
            if (redeployCharNameSpan) redeployCharNameSpan.textContent = '--';
            if (redeployCharCostSpan) redeployCharCostSpan.textContent = '--';
            if (redeployOriginalHpSpan) redeployOriginalHpSpan.textContent = '--';
            if (redeployCostConsumedSpan) redeployCostConsumedSpan.textContent = '--';
            if (redeployCalculatedHpSpan) redeployCalculatedHpSpan.textContent = '--';
            if (simulationHpBarFill) { simulationHpBarFill.style.transform = 'scaleX(0)'; simulationHpBarFill.classList.remove('hp-bar-low-pulse');}
            if (simulationHpPercentageDisplay) { simulationHpPercentageDisplay.classList.remove('show'); simulationHpPercentageDisplay.textContent = '';}
            if (redeployCalculatedHpSpan) { redeployCalculatedHpSpan.classList.remove('low-hp-value', 'red-value');}
            const awakeningArea = document.querySelector('.awakening-simulation-area');
            if (awakeningArea) awakeningArea.style.display = 'none';
            if (beforeShotdownAwakeningGaugeInput) beforeShotdownAwakeningGaugeInput.value = 0;
            if (beforeShotdownHpInput_damageTakenInput) { beforeShotdownHpInput_damageTakenInput.value = 0; beforeShotdownHpInput_damageTakenInput.style.borderColor = '';}
            if(considerOwnDownCheckbox) considerOwnDownCheckbox.checked = false;
            if (considerDamageDealtCheckbox) {
                considerDamageDealtCheckbox.checked = false;
                if(damageDealtOptionsContainer) damageDealtOptionsContainer.style.display = 'none';
                if(damageDealtAwakeningBonusSelect) damageDealtAwakeningBonusSelect.value = "0";
            }
            if (considerPartnerDownCheckbox) considerPartnerDownCheckbox.checked = false;
            if (predictedAwakeningGaugeSpan) predictedAwakeningGaugeSpan.textContent = '--';
            if (awakeningAvailabilitySpan) { awakeningAvailabilitySpan.textContent = '--'; awakeningAvailabilitySpan.className = 'info-value';}
        }
    });
}

function calculateRedeployEffect(charToRedeploy, partnerChar, currentTeamCostRemaining, currentRedeployCount, isTeamHpScenario = false) {
    const charFullCost = charToRedeploy.cost;
    const originalHp = charToRedeploy.hp;
    let calculatedHpGained = 0;
    let costActuallyConsumed = 0;
    let finalNote = "";
    let teamCostAfterConsumption = currentTeamCostRemaining;

    if (currentTeamCostRemaining < 0.001 && !(isTeamHpScenario && currentTeamCostRemaining === 0 && charFullCost > 0)) {
        calculatedHpGained = 0; costActuallyConsumed = 0; finalNote = "チームコスト0のため出撃不可";
        return { hpGained: calculatedHpGained, costConsumed: costActuallyConsumed, note: finalNote, remainingCostAfterConsumption: currentTeamCostRemaining };
    }

    let hpBasedOnPreRedeployCost;
    let initialNotePart = "";
    if (currentTeamCostRemaining >= charFullCost) {
        hpBasedOnPreRedeployCost = originalHp;
        initialNotePart = `(${charFullCost.toFixed(1)}コスト換算)`;
    } else {
        hpBasedOnPreRedeployCost = (charFullCost > 0) ? Math.round(originalHp * (currentTeamCostRemaining / charFullCost)) : 0;
        initialNotePart = `コストオーバー (${currentTeamCostRemaining.toFixed(1)}コスト換算)`;
    }

    if (currentTeamCostRemaining >= charFullCost) {
        costActuallyConsumed = charFullCost;
    } else {
        costActuallyConsumed = currentTeamCostRemaining;
    }
    teamCostAfterConsumption = Math.max(0.0, currentTeamCostRemaining - costActuallyConsumed);

    calculatedHpGained = hpBasedOnPreRedeployCost;
    finalNote = initialNotePart;

    if (isTeamHpScenario) {
        if (teamCostAfterConsumption < charFullCost && teamCostAfterConsumption > 0.0001) {
            calculatedHpGained = Math.round(originalHp * (teamCostAfterConsumption / charFullCost));
             if (!initialNotePart.toLowerCase().includes("コストオーバー")) {
                finalNote = `(${charFullCost.toFixed(1)}コスト換算), 消費後実質コストオーバー(${teamCostAfterConsumption.toFixed(1)}換算)`;
            } else { // Was already a cost-over, note should reflect the new effective cost for HP
                finalNote = `コストオーバー (${teamCostAfterConsumption.toFixed(1)}換算)`;
            }
        }
    }

    if (teamCostAfterConsumption < 0.001) {
        calculatedHpGained = 0;
        if (finalNote && !finalNote.endsWith(", ") && finalNote.length > 0) finalNote += ", ";
        else if (!finalNote) finalNote = "";
        if (!finalNote.includes("最終残りコスト0のためHP0")) {
             finalNote += "最終残りコスト0のためHP0";
        }
    }
    if (currentTeamCostRemaining < 0.001 && costActuallyConsumed == 0 && !initialNotePart.includes("出撃不可")) {
         finalNote = "チームコスト0のため出撃不可";
         calculatedHpGained = 0;
    }
    return { hpGained: calculatedHpGained, costConsumed: costActuallyConsumed, note: finalNote, remainingCostAfterConsumption: teamCostAfterConsumption };
}


function simulateRemainingSequenceContinuous(fallingChar, initialRemainingCost, fallCountOfThisCharBeforeThisSubsequence, isTeamScenario) {
    let currentTeamCostRemaining = initialRemainingCost;
    let totalGainedHpInSubSequence = 0;
    const subSequence = [];
    let currentFallCountForChar = fallCountOfThisCharBeforeThisSubsequence;
    const maxRedeployAttempts = 5; let attemptsInSub = 0;

    while (currentTeamCostRemaining >= 0.001 && attemptsInSub < maxRedeployAttempts) {
        attemptsInSub++;
        let result = calculateRedeployEffect(fallingChar, null, currentTeamCostRemaining, currentFallCountForChar, isTeamScenario);
        if (result.note.includes("出撃不可") && result.hpGained <= 0 && result.costConsumed <= 0 && currentTeamCostRemaining < 0.001 && attemptsInSub > 1 ) break;

        subSequence.push({
            turn: attemptsInSub, charName: fallingChar.name, charType: (fallingChar === selectedPlayerChar) ? "自機" : "相方",
            charCost: fallingChar.cost, hpGained: result.hpGained, costConsumed: result.costConsumed,
            remainingCost: result.remainingCostAfterConsumption.toFixed(1), note: result.note
        });
        totalGainedHpInSubSequence += result.hpGained;
        currentTeamCostRemaining = result.remainingCostAfterConsumption;
        currentFallCountForChar++;
        if (result.note.includes("出撃不可") && result.hpGained <= 0 && result.costConsumed <= 0 && currentTeamCostRemaining < 0.001) break;
    }
    return { totalHp: totalGainedHpInSubSequence, sequence: subSequence };
}

function simulateRemainingSequenceAlternating(charA, charB, initialRemainingCost, fallCountA_before, fallCountB_before, isTeamScenario) {
    let currentTeamCostRemaining = initialRemainingCost;
    let totalGainedHpInSubSequence = 0;
    const subSequence = [];
    let currentFallCountA = fallCountA_before; let currentFallCountB = fallCountB_before;
    const maxRedeployAttempts = 5; let attemptsInSub = 0; let nextToFallIsA = true;

    while (currentTeamCostRemaining >= 0.001 && attemptsInSub < maxRedeployAttempts) {
        attemptsInSub++;
        let charToRedeploy, currentOverallFallCountForChar;
        if (nextToFallIsA) { charToRedeploy = charA; currentOverallFallCountForChar = currentFallCountA; currentFallCountA++;}
        else { charToRedeploy = charB; currentOverallFallCountForChar = currentFallCountB; currentFallCountB++; }
        let result = calculateRedeployEffect(charToRedeploy, null, currentTeamCostRemaining, currentOverallFallCountForChar, isTeamScenario);
        if (result.note.includes("出撃不可") && result.hpGained <= 0 && result.costConsumed <= 0 && currentTeamCostRemaining < 0.001 && attemptsInSub > 1) break;

        subSequence.push({
            turn: attemptsInSub, charName: charToRedeploy.name, charType: (charToRedeploy === selectedPlayerChar) ? "自機" : "相方",
            charCost: charToRedeploy.cost, hpGained: result.hpGained, costConsumed: result.costConsumed,
            remainingCost: result.remainingCostAfterConsumption.toFixed(1), note: result.note
        });
        totalGainedHpInSubSequence += result.hpGained;
        currentTeamCostRemaining = result.remainingCostAfterConsumption;
        nextToFallIsA = !nextToFallIsA;
        if (result.note.includes("出撃不可") && result.hpGained <= 0 && result.costConsumed <= 0 && currentTeamCostRemaining < 0.001) break;
    }
    return { totalHp: totalGainedHpInSubSequence, sequence: subSequence };
}

function simulateMinimumSequence(fallingChar, isTeamScenario) {
    let currentTeamCostRemaining = MAX_TEAM_COST;
    let totalGainedRedeployHp = 0; let redeployCountForThisCharInSequence = 0; const sequence = [];
    const maxRedeployAttempts = 10; let attempts = 0;

    while (currentTeamCostRemaining >= 0.001 && attempts < maxRedeployAttempts) {
        attempts++;
        let result = calculateRedeployEffect(fallingChar, null, currentTeamCostRemaining, redeployCountForThisCharInSequence, isTeamScenario);
        if (result.note.includes("出撃不可") && result.hpGained <= 0 && result.costConsumed <= 0 && currentTeamCostRemaining < 0.001 && attempts > 1) break;

        sequence.push({
            turn: redeployCountForThisCharInSequence + 1, charName: fallingChar.name, charType: (fallingChar === selectedPlayerChar) ? "自機" : "相方",
            charCost: fallingChar.cost, hpGained: result.hpGained, costConsumed: result.costConsumed,
            remainingCost: result.remainingCostAfterConsumption.toFixed(1), note: result.note
        });
        totalGainedRedeployHp += result.hpGained;
        currentTeamCostRemaining = result.remainingCostAfterConsumption;
        redeployCountForThisCharInSequence++;
        if (result.note.includes("出撃不可") && result.hpGained <= 0 && result.costConsumed <= 0 && currentTeamCostRemaining < 0.001) break;
    }
    return { totalHp: totalGainedRedeployHp, sequence: sequence };
}


function findTeamHpCombinations() {
    if (!selectedPlayerChar || !selectedPartnerChar) {
        gsap.to(totalHpDisplayArea, { opacity: 0, y: 20, duration: 0.3, ease: "power2.in", onComplete: () => {
            if (highestHpScenarioTitleSpan) highestHpScenarioTitleSpan.textContent = 'チーム合計耐久値(最高)';
            if (idealGainedHpSpan) idealGainedHpSpan.textContent = '--';
            if (idealSequenceList) idealSequenceList.innerHTML = '';
            if (compromiseHpScenarioTitleSpan) compromiseHpScenarioTitleSpan.textContent = 'チーム合計耐久値(妥協)';
            if (minGainedHpHpSpan) minGainedHpHpSpan.textContent = '--';
            if (minSequenceList) minSequenceList.innerHTML = '';
            if (bombHpScenarioTitleSpan) bombHpScenarioTitleSpan.textContent = 'チーム合計耐久値(爆弾)';
            if (bombGainedHpSpan) bombGainedHpSpan.textContent = '--';
            if (bombSequenceList) bombSequenceList.innerHTML = '';
            if (lowestHpScenarioTitleSpan) lowestHpScenarioTitleSpan.textContent = 'チーム合計耐久値(最低)';
            if (lowestGainedHpSpan) lowestGainedHpSpan.textContent = '--';
            if (lowestSequenceList) lowestSequenceList.innerHTML = '';
        }});
        return;
    }
    const IS_TEAM_SCENARIO = true;

    let firstFallChar_highest, secondFallChar_highest;
    if (selectedPlayerChar.cost > selectedPartnerChar.cost) { firstFallChar_highest = selectedPlayerChar; secondFallChar_highest = selectedPartnerChar; }
    else if (selectedPartnerChar.cost > selectedPlayerChar.cost) { firstFallChar_highest = selectedPartnerChar; secondFallChar_highest = selectedPlayerChar; }
    else { if (selectedPlayerChar.hp >= selectedPartnerChar.hp) { firstFallChar_highest = selectedPlayerChar; secondFallChar_highest = selectedPartnerChar; }
           else { firstFallChar_highest = selectedPartnerChar; secondFallChar_highest = selectedPlayerChar; } }
    let highestHpScenario = { name: "", totalHp: 0, sequence: [] };
    let currentHpForHighest = selectedPlayerChar.hp + selectedPartnerChar.hp;
    let currentCostForHighest = MAX_TEAM_COST;
    let highestSequence = [];
    let fallCount_A_highest = 0; let fallCount_B_highest = 0; let currentTurn_highest = 0;
    highestSequence.push({ turn: currentTurn_highest++, charName: "初期HP", charType: "", charCost: 0, hpGained: currentHpForHighest, costConsumed: 0, remainingCost: currentCostForHighest.toFixed(1), note: `${selectedPlayerChar.name} (${selectedPlayerChar.hp.toLocaleString()}) + ${selectedPartnerChar.name} (${selectedPartnerChar.hp.toLocaleString()})` });
    let res1_highest = calculateRedeployEffect(firstFallChar_highest, null, currentCostForHighest, fallCount_A_highest++, IS_TEAM_SCENARIO);
    currentHpForHighest += res1_highest.hpGained; currentCostForHighest = res1_highest.remainingCostAfterConsumption;
    highestSequence.push({ turn: currentTurn_highest++, charName: firstFallChar_highest.name, charType: (firstFallChar_highest === selectedPlayerChar) ? "自機" : "相方", charCost: firstFallChar_highest.cost, hpGained: res1_highest.hpGained, costConsumed: res1_highest.costConsumed, remainingCost: currentCostForHighest.toFixed(1), note: res1_highest.note });
    if (currentCostForHighest >= 0.001 && !(res1_highest.note.includes("出撃不可") && res1_highest.hpGained <= 0 && res1_highest.costConsumed <= 0 && currentCostForHighest < 0.001)) {
        let res2_highest = calculateRedeployEffect(secondFallChar_highest, null, currentCostForHighest, fallCount_B_highest++, IS_TEAM_SCENARIO);
        currentHpForHighest += res2_highest.hpGained; currentCostForHighest = res2_highest.remainingCostAfterConsumption;
        highestSequence.push({ turn: currentTurn_highest++, charName: secondFallChar_highest.name, charType: (secondFallChar_highest === selectedPlayerChar) ? "自機" : "相方", charCost: secondFallChar_highest.cost, hpGained: res2_highest.hpGained, costConsumed: res2_highest.costConsumed, remainingCost: currentCostForHighest.toFixed(1), note: res2_highest.note });
        if (currentCostForHighest >= 0.001 && !(res2_highest.note.includes("出撃不可") && res2_highest.hpGained <= 0 && res2_highest.costConsumed <= 0 && currentCostForHighest < 0.001)) {
            const subA_h = simulateRemainingSequenceAlternating(firstFallChar_highest, secondFallChar_highest, currentCostForHighest, fallCount_A_highest, fallCount_B_highest, IS_TEAM_SCENARIO);
            const subB_h = simulateRemainingSequenceContinuous(firstFallChar_highest, currentCostForHighest, fallCount_A_highest, IS_TEAM_SCENARIO);
            const subC_h = simulateRemainingSequenceContinuous(secondFallChar_highest, currentCostForHighest, fallCount_B_highest, IS_TEAM_SCENARIO);
            let bestSub_h = subA_h; if (subB_h.totalHp > bestSub_h.totalHp) bestSub_h = subB_h; if (subC_h.totalHp > bestSub_h.totalHp) bestSub_h = subC_h;
            currentHpForHighest += bestSub_h.totalHp; let subTurnCounter = currentTurn_highest; bestSub_h.sequence.forEach(item => { highestSequence.push({ ...item, turn: subTurnCounter++ }); });
        }
    }
    highestHpScenario.totalHp = currentHpForHighest; highestHpScenario.sequence = highestSequence; highestHpScenario.name = `チーム合計耐久値(理想) (${firstFallChar_highest.name}先落ち→${secondFallChar_highest.name}後落ち後最適化)`;

    let firstFallChar_compromise, secondFallChar_compromise;
    if (selectedPlayerChar.cost < selectedPartnerChar.cost) { firstFallChar_compromise = selectedPlayerChar; secondFallChar_compromise = selectedPartnerChar; }
    else if (selectedPartnerChar.cost < selectedPlayerChar.cost) { firstFallChar_compromise = selectedPartnerChar; secondFallChar_compromise = selectedPlayerChar; }
    else { if (selectedPlayerChar.hp <= selectedPartnerChar.hp) { firstFallChar_compromise = selectedPlayerChar; secondFallChar_compromise = selectedPartnerChar; } else { firstFallChar_compromise = selectedPartnerChar; secondFallChar_compromise = selectedPlayerChar;} }
    let compromiseScenario = { name: "", totalHp: 0, sequence: [] };
    let currentHpForCompromise = selectedPlayerChar.hp + selectedPartnerChar.hp;
    let currentCostForCompromise = MAX_TEAM_COST;
    let compromiseSequence = [];
    let fallCount_A_compromise = 0; let fallCount_B_compromise = 0; let currentTurn_compromise = 0;
    compromiseSequence.push({ turn: currentTurn_compromise++, charName: "初期HP", charType: "", charCost: 0, hpGained: currentHpForCompromise, costConsumed: 0, remainingCost: currentCostForCompromise.toFixed(1), note: `${selectedPlayerChar.name} (${selectedPlayerChar.hp.toLocaleString()}) + ${selectedPartnerChar.name} (${selectedPartnerChar.hp.toLocaleString()})` });
    let res1_compromise = calculateRedeployEffect(firstFallChar_compromise, null, currentCostForCompromise, fallCount_A_compromise++, IS_TEAM_SCENARIO);
    currentHpForCompromise += res1_compromise.hpGained; currentCostForCompromise = res1_compromise.remainingCostAfterConsumption;
    compromiseSequence.push({ turn: currentTurn_compromise++, charName: firstFallChar_compromise.name, charType: (firstFallChar_compromise === selectedPlayerChar) ? "自機" : "相方", charCost: firstFallChar_compromise.cost, hpGained: res1_compromise.hpGained, costConsumed: res1_compromise.costConsumed, remainingCost: currentCostForCompromise.toFixed(1), note: res1_compromise.note });
    if(currentCostForCompromise >= 0.001 && !(res1_compromise.note.includes("出撃不可") && res1_compromise.hpGained <= 0 && res1_compromise.costConsumed <= 0 && currentCostForCompromise < 0.001)) {
        let res2_compromise = calculateRedeployEffect(secondFallChar_compromise, null, currentCostForCompromise, fallCount_B_compromise++, IS_TEAM_SCENARIO);
        currentHpForCompromise += res2_compromise.hpGained; currentCostForCompromise = res2_compromise.remainingCostAfterConsumption;
        compromiseSequence.push({ turn: currentTurn_compromise++, charName: secondFallChar_compromise.name, charType: (secondFallChar_compromise === selectedPlayerChar) ? "自機" : "相方", charCost: secondFallChar_compromise.cost, hpGained: res2_compromise.hpGained, costConsumed: res2_compromise.costConsumed, remainingCost: currentCostForCompromise.toFixed(1), note: res2_compromise.note });
        if (currentCostForCompromise >= 0.001 && !(res2_compromise.note.includes("出撃不可") && res2_compromise.hpGained <= 0 && res2_compromise.costConsumed <= 0 && currentCostForCompromise < 0.001)) {
            const subA_c = simulateRemainingSequenceAlternating(firstFallChar_compromise, secondFallChar_compromise, currentCostForCompromise, fallCount_A_compromise, fallCount_B_compromise, IS_TEAM_SCENARIO);
            const subB_c = simulateRemainingSequenceContinuous(firstFallChar_compromise, currentCostForCompromise, fallCount_A_compromise, IS_TEAM_SCENARIO);
            const subC_c = simulateRemainingSequenceContinuous(secondFallChar_compromise, currentCostForCompromise, fallCount_B_compromise, IS_TEAM_SCENARIO);
            let bestSub_c = subA_c; if (subB_c.totalHp > bestSub_c.totalHp) bestSub_c = subB_c; if (subC_c.totalHp > bestSub_c.totalHp) bestSub_c = subC_c;
            currentHpForCompromise += bestSub_c.totalHp; let subTurnCounter_c = currentTurn_compromise; bestSub_c.sequence.forEach(item => { compromiseSequence.push({ ...item, turn: subTurnCounter_c++ }); });
        }
    }
    compromiseScenario.totalHp = currentHpForCompromise; compromiseScenario.sequence = compromiseSequence; compromiseScenario.name = `チーム合計耐久値(妥協) (${firstFallChar_compromise.name}先落ち→${secondFallChar_compromise.name}後落ち後最適化)`;

    let fallingChar_bomb;
    if (selectedPlayerChar.cost < selectedPartnerChar.cost) { fallingChar_bomb = selectedPlayerChar; }
    else if (selectedPartnerChar.cost < selectedPlayerChar.cost) { fallingChar_bomb = selectedPartnerChar; }
    else { fallingChar_bomb = (selectedPlayerChar.hp <= selectedPartnerChar.hp) ? selectedPlayerChar : selectedPartnerChar; }
    const bombFallResult = simulateMinimumSequence(fallingChar_bomb, IS_TEAM_SCENARIO);
    const bombTotalHp = selectedPlayerChar.hp + selectedPartnerChar.hp + bombFallResult.totalHp;
    let bombSequence = [ { turn: 0, charName: "初期HP", charType: "", charCost: 0, hpGained: selectedPlayerChar.hp + selectedPartnerChar.hp, costConsumed: 0, remainingCost: MAX_TEAM_COST.toFixed(1), note: `${selectedPlayerChar.name} (${selectedPlayerChar.hp.toLocaleString()}) + ${selectedPartnerChar.name} (${selectedPartnerChar.hp.toLocaleString()})` } ];
    bombFallResult.sequence.forEach(item => { bombSequence.push(item); });
    const bombResult = { name: `チーム合計耐久値(爆弾) (${fallingChar_bomb.name}のみ連続撃墜)`, totalHp: bombTotalHp, sequence: bombSequence };

    const playerFocusRedeploys = simulateMinimumSequence(selectedPlayerChar, IS_TEAM_SCENARIO);
    const lowestPlayerFocusTotalHp = selectedPlayerChar.hp + playerFocusRedeploys.totalHp;
    let lowestPlayerFocusSequence = [ { turn: 0, charName: "初期HP", charType: "", charCost: 0, hpGained: selectedPlayerChar.hp, costConsumed: 0, remainingCost: MAX_TEAM_COST.toFixed(1), note: `${selectedPlayerChar.name}(${selectedPlayerChar.hp.toLocaleString()})で開始、${selectedPlayerChar.name}が集中狙い` } ];
    playerFocusRedeploys.sequence.forEach(item => lowestPlayerFocusSequence.push(item));

    const partnerFocusRedeploys = simulateMinimumSequence(selectedPartnerChar, IS_TEAM_SCENARIO);
    const lowestPartnerFocusTotalHp = selectedPartnerChar.hp + partnerFocusRedeploys.totalHp;
    let lowestPartnerFocusSequence = [ { turn: 0, charName: "初期HP", charType: "", charCost: 0, hpGained: selectedPartnerChar.hp, costConsumed: 0, remainingCost: MAX_TEAM_COST.toFixed(1), note: `${selectedPartnerChar.name}(${selectedPartnerChar.hp.toLocaleString()})で開始、${selectedPartnerChar.name}が集中狙い` } ];
    partnerFocusRedeploys.sequence.forEach(item => lowestPartnerFocusSequence.push(item));

    let lowestResult;
    if (lowestPlayerFocusTotalHp <= lowestPartnerFocusTotalHp) {
        lowestResult = { name: `チーム合計耐久値(最低/${selectedPlayerChar.name}集中狙い)`, totalHp: lowestPlayerFocusTotalHp, sequence: lowestPlayerFocusSequence };
    } else {
        lowestResult = { name: `チーム合計耐久値(最低/${selectedPartnerChar.name}集中狙い)`, totalHp: lowestPartnerFocusTotalHp, sequence: lowestPartnerFocusSequence };
    }

    gsap.delayedCall(0.1, () => displayTotalTeamHpResults(highestHpScenario, compromiseScenario, bombResult, lowestResult));
}

function displayTotalTeamHpResults(idealScenario, compromiseScenario, bombScenario, lowestScenario) {
    // maxTeamCostValueDisplayはHTMLから削除されたため、ここでの参照も削除
    if (selectedPlayerCharNameSummary && selectedPlayerChar) selectedPlayerCharNameSummary.textContent = selectedPlayerChar.name;
    if (selectedPartnerCharNameSummary && selectedPartnerChar) selectedPartnerCharNameSummary.textContent = selectedPartnerChar.name;
    if (totalHpDisplayArea) { totalHpDisplayArea.style.opacity = 1; totalHpDisplayArea.style.transform = 'translateY(0)'; totalHpDisplayArea.classList.add('active'); } else return;
    const generateListItems = (sequence) => {
        return sequence?.map(item => {
            const charTypeDisplay = item.charType ? ` (${item.charType})` : '';
            // const costConsumedDisplay = typeof item.costConsumed === 'number' ? item.costConsumed.toFixed(1) : String(item.costConsumed); // Not used in the final string

            let processedNote = item.note; // Start with the original note

            // Regex to find: "(X.Xコスト換算), 消費後実質コストオーバー(Y.Y換算)"
            // Replace with: "コストオーバー(Y.Y換算)"
            const regexToReplace = /\((\d+\.\d+)コスト換算\), 消費後実質コストオーバー\((\d+\.\d+)換算\)/;
            processedNote = processedNote.replace(regexToReplace, (match, p1, p2) => {
                // p1 is the full cost (e.g., "2.5")
                // p2 is the effective cost after consumption (e.g., "0.5")
                return `コストオーバー(${p2}換算)`;
            });

            const remainingCostDisplay = item.remainingCost !== undefined ? `, 残り: ${item.remainingCost}` : '';
            return `<li>${item.turn}落ち: ${item.charName}${charTypeDisplay} - ${item.hpGained.toLocaleString()} HP獲得 (${processedNote}${remainingCostDisplay})</li>`;
        }).join('') || '';
    };
    if(highestHpScenarioTitleSpan) highestHpScenarioTitleSpan.textContent = idealScenario.name;
    if(idealGainedHpSpan) idealGainedHpSpan.textContent = idealScenario.totalHp?.toLocaleString() || '--';
    if(idealSequenceList) idealSequenceList.innerHTML = generateListItems(idealScenario.sequence);
    if(compromiseHpScenarioTitleSpan) compromiseHpScenarioTitleSpan.textContent = compromiseScenario.name;
    if(minGainedHpHpSpan) minGainedHpHpSpan.textContent = compromiseScenario.totalHp?.toLocaleString() || '--';
    if(minSequenceList) minSequenceList.innerHTML = generateListItems(compromiseScenario.sequence);
    if(bombHpScenarioTitleSpan) bombHpScenarioTitleSpan.textContent = bombScenario.name;
    if(bombGainedHpSpan) bombGainedHpSpan.textContent = bombScenario.totalHp?.toLocaleString() || '--';
    if(bombSequenceList) bombSequenceList.innerHTML = generateListItems(bombScenario.sequence);
    if(lowestHpScenarioTitleSpan) lowestHpScenarioTitleSpan.textContent = lowestScenario.name;
    if(lowestGainedHpSpan) lowestGainedHpSpan.textContent = lowestScenario.totalHp?.toLocaleString() || '--';
    if(lowestSequenceList) lowestSequenceList.innerHTML = generateListItems(lowestScenario.sequence);
    if (totalHpDisplayArea) gsap.to(totalHpDisplayArea, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
}

function simulateRedeploy(charType) {
    if (!selectedPlayerChar || !selectedPartnerChar) { alert("自機と相方の両方を選択してください。"); resetSimulationResults(); return; }
    currentlySimulatingCharType = charType;

    const allocatedCostForThisRedeploy = parseFloat(remainingTeamCostInput.value);
    let charToRedeploy = (charType === 'player') ? selectedPlayerChar : selectedPartnerChar;

    let calculatedHp;
    let actualCostConsumed = 0;
    const originalCharHp = charToRedeploy.hp;
    const charFullCost = charToRedeploy.cost;

    if (charFullCost <= 0 || allocatedCostForThisRedeploy <= 0) {
        calculatedHp = 0;
    } else if (allocatedCostForThisRedeploy >= charFullCost) {
        calculatedHp = originalCharHp;
    } else {
        calculatedHp = Math.round(originalCharHp * (allocatedCostForThisRedeploy / charFullCost));
    }

    if (allocatedCostForThisRedeploy >= charFullCost) {
        actualCostConsumed = charFullCost;
    } else if (allocatedCostForThisRedeploy > 0) {
        actualCostConsumed = allocatedCostForThisRedeploy;
    } else {
        actualCostConsumed = 0;
    }

    redeployCharNameSpan.textContent = charToRedeploy.name;
    redeployCharCostSpan.textContent = charToRedeploy.cost.toFixed(1);
    redeployOriginalHpSpan.textContent = charToRedeploy.hp.toLocaleString();
    redeployCostConsumedSpan.textContent = actualCostConsumed.toFixed(1);
    redeployCalculatedHpSpan.textContent = calculatedHp.toLocaleString();
    const originalHpValue = charToRedeploy.hp;
    redeployCalculatedHpSpan.classList.remove('red-value', 'low-hp-value');
    if (originalHpValue > 0 && calculatedHp < originalHpValue && calculatedHp > 0) { redeployCalculatedHpSpan.classList.add('red-value'); }
    else if (calculatedHp === 0 && originalHpValue > 0) { redeployCalculatedHpSpan.classList.add('red-value'); }
    const hpPercentage = originalHpValue > 0 ? (calculatedHp / originalHpValue) : 0;
    gsap.to(simulationHpBarFill, {
        scaleX: hpPercentage, duration: 0.8, ease: "power3.out", transformOrigin: 'left center', overwrite: true,
        onUpdate: () => { if (simulationHpPercentageDisplay) simulationHpPercentageDisplay.textContent = `${Math.round(gsap.getProperty(simulationHpBarFill, "scaleX") * 100)}%`; },
        onComplete: () => { if (simulationHpPercentageDisplay) simulationHpPercentageDisplay.textContent = `${Math.round(hpPercentage * 100)}%`; }
    });
    if (hpPercentage <= 0.3) simulationHpBarFill.classList.add('hp-bar-low-pulse'); else simulationHpBarFill.classList.remove('hp-bar-low-pulse');
    if (simulationHpPercentageDisplay) simulationHpPercentageDisplay.classList.add('show');

    const targetCharForAwakeningData = charToRedeploy;
    if (beforeShotdownAwakeningGaugeInput) {
        beforeShotdownAwakeningGaugeInput.dataset.originalCharacterHp = targetCharForAwakeningData.hp;
        beforeShotdownAwakeningGaugeInput.dataset.characterCost = targetCharForAwakeningData.cost.toFixed(1);
    }
    if (beforeShotdownHpInput_damageTakenInput) {
        beforeShotdownHpInput_damageTakenInput.max = targetCharForAwakeningData.hp;
        beforeShotdownHpInput_damageTakenInput.dataset.originalCharacterHp = targetCharForAwakeningData.hp;
        beforeShotdownHpInput_damageTakenInput.dataset.characterCost = targetCharForAwakeningData.cost.toFixed(1);
    }

    gsap.fromTo(simulationResultsDiv, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", onComplete: () => {
        simulationResultsDiv.classList.add('active');
        const awakeningArea = document.querySelector('.awakening-simulation-area');
        if (awakeningArea) awakeningArea.style.display = 'block';
        calculateAndDisplayAwakeningGauge();
    }});
};

function calculateAndDisplayAwakeningGauge() {
    if (!predictedAwakeningGaugeSpan || !awakeningAvailabilitySpan || !beforeShotdownAwakeningGaugeInput || !beforeShotdownHpInput_damageTakenInput ||
        !considerOwnDownCheckbox || !considerDamageDealtCheckbox || !damageDealtAwakeningBonusSelect || !considerPartnerDownCheckbox) return;

    let charForBonusCost;
    if (currentlySimulatingCharType === 'player' && selectedPlayerChar) {
        charForBonusCost = selectedPlayerChar;
    } else if (currentlySimulatingCharType === 'partner' && selectedPartnerChar) {
        charForBonusCost = selectedPartnerChar;
    } else {
        charForBonusCost = { cost: parseFloat(beforeShotdownHpInput_damageTakenInput.dataset.characterCost || "0") };
    }

    const originalCharActualMaxHp = parseFloat(beforeShotdownHpInput_damageTakenInput.dataset.originalCharacterHp);
    const gaugeBeforeShotdown = parseFloat(beforeShotdownAwakeningGaugeInput.value) || 0;
    let damageTakenInputValue = parseFloat(beforeShotdownHpInput_damageTakenInput.value);

    if (isNaN(originalCharActualMaxHp) || !charForBonusCost || isNaN(charForBonusCost.cost) ||
        isNaN(gaugeBeforeShotdown) || isNaN(damageTakenInputValue) || originalCharActualMaxHp <= 0) {
        predictedAwakeningGaugeSpan.textContent = '---';
        awakeningAvailabilitySpan.textContent = '--'; awakeningAvailabilitySpan.className = 'info-value';
        if(beforeShotdownHpInput_damageTakenInput) beforeShotdownHpInput_damageTakenInput.style.borderColor = 'red';
        return;
    }
    if(beforeShotdownHpInput_damageTakenInput) beforeShotdownHpInput_damageTakenInput.style.borderColor = '';
    let actualDamageTaken = Math.max(0, Math.min(damageTakenInputValue, originalCharActualMaxHp));
    if(beforeShotdownHpInput_damageTakenInput.value !== actualDamageTaken.toString()) beforeShotdownHpInput_damageTakenInput.value = actualDamageTaken;

    const hpLossPercentage = (originalCharActualMaxHp > 0) ? (actualDamageTaken / originalCharActualMaxHp) * 100 : 0;
    const damageBasedGaugeIncrease = Math.floor(hpLossPercentage * AVERAGE_GAUGE_COEFFICIENT);
    let costBonusOnOwnDown = 0;
    if (considerOwnDownCheckbox.checked) {
        costBonusOnOwnDown = AWAKENING_BONUS_BY_COST[charForBonusCost.cost.toFixed(1)] || 0;
    }
    let additionalGaugeFromDamageDealt = 0;
    if (considerDamageDealtCheckbox.checked) additionalGaugeFromDamageDealt = parseInt(damageDealtAwakeningBonusSelect.value) || 0;
    let additionalGaugeFromPartnerDown = 0;
    if (considerPartnerDownCheckbox.checked) {
        additionalGaugeFromPartnerDown = PARTNER_DOWN_AWAKENING_BONUS[charForBonusCost.cost.toFixed(1)] || 0;
    }
    let finalPredictedGauge = gaugeBeforeShotdown + damageBasedGaugeIncrease + costBonusOnOwnDown + additionalGaugeFromDamageDealt + additionalGaugeFromPartnerDown;
    finalPredictedGauge = Math.max(0, Math.min(100, Math.floor(finalPredictedGauge)));
    predictedAwakeningGaugeSpan.textContent = finalPredictedGauge;
    awakeningAvailabilitySpan.classList.remove('awakening-possible', 'awakening-not-possible');
    if (finalPredictedGauge >= AWAKENING_THRESHOLD) {
        awakeningAvailabilitySpan.textContent = '使用可能'; awakeningAvailabilitySpan.classList.add('awakening-possible');
    } else {
        awakeningAvailabilitySpan.textContent = '使用不可'; awakeningAvailabilitySpan.classList.add('awakening-not-possible');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    characterGrid = document.getElementById('characterGrid');
    characterSearchInput = document.getElementById('characterSearch');
    searchIcon = document.querySelector('.search-icon');
    costFilterButtons = document.querySelectorAll('#costFilter .filter-button');
    sortFilterButtons = document.querySelectorAll('#sortFilter .filter-button');
    accordionHeaders = document.querySelectorAll('.accordion-header:not(.sub-accordion-header)'); // ★セレクタを調整★
    loadingOverlay = document.getElementById('loadingOverlay');
    playerCharSelect = document.getElementById('playerCharSelect');
    partnerCharSelect = document.getElementById('partnerCharSelect');
    totalTeamCostSpan = document.getElementById('totalTeamCost');
    selectedCharsDisplay = document.getElementById('selectedCharsDisplay');
    remainingTeamCostInput = document.getElementById('remainingTeamCostInput');
    simulatePlayerRedeployBtn = document.getElementById('simulatePlayerRedeploy');
    simulatePartnerRedeployBtn = document.getElementById('simulatePartnerRedeploy');
    simulationResultsDiv = document.getElementById('simulationResults');
    redeployCharNameSpan = document.getElementById('redeployCharName');
    redeployCharCostSpan = document.getElementById('redeployCharCost');
    redeployOriginalHpSpan = document.getElementById('redeployOriginalHp');
    redeployCostConsumedSpan = document.getElementById('redeployCostConsumed');
    redeployCalculatedHpSpan = document.getElementById('redeployCalculatedHp');
    if (simulationResultsDiv) {
         simulationHpBarFill = simulationResultsDiv.querySelector('.hp-bar-fill');
         simulationHpPercentageDisplay = simulationResultsDiv.querySelector('.hp-percentage-display');
    }
    totalHpDisplayArea = document.getElementById('totalHpDisplayArea');
    // maxTeamCostValueDisplayはHTMLから削除されたため、ここでの参照も削除
    highestHpScenarioTitleSpan = document.getElementById('highestHpScenarioTitle');
    idealGainedHpSpan = document.getElementById('idealGainedHp');
    idealSequenceList = document.getElementById('idealSequenceList');
    compromiseHpScenarioTitleSpan = document.getElementById('compromiseHpScenarioTitle');
    minGainedHpHpSpan = document.getElementById('minGainedHpHpSpan');
    minSequenceList = document.getElementById('minSequenceList');
    lowestHpScenarioTitleSpan = document.getElementById('lowestHpScenarioTitle');
    lowestGainedHpSpan = document.getElementById('lowestGainedHp');
    lowestSequenceList = document.getElementById('lowestSequenceList');
    bombHpScenarioTitleSpan = document.getElementById('bombHpScenarioTitle');
    bombGainedHpSpan = document.getElementById('bombGainedHp');
    bombSequenceList = document.getElementById('bombSequenceList');
    selectedPlayerCharNameSummary = document.getElementById('selectedPlayerCharNameSummary');
    selectedPartnerCharNameSummary = document.getElementById('selectedPartnerCharNameSummary');
    beforeShotdownAwakeningGaugeInput = document.getElementById('beforeShotdownAwakeningGaugeInput');
    beforeShotdownHpInput_damageTakenInput = document.getElementById('beforeShotdownHpInput');
    predictedAwakeningGaugeSpan = document.getElementById('predictedAwakeningGauge');
    awakeningAvailabilitySpan = document.getElementById('awakeningAvailability');
    considerOwnDownCheckbox = document.getElementById('considerOwnDownCheckbox');
    considerDamageDealtCheckbox = document.getElementById('considerDamageDealtCheckbox');
    damageDealtOptionsContainer = document.getElementById('damageDealtOptionsContainer');
    damageDealtAwakeningBonusSelect = document.getElementById('damageDealtAwakeningBonusSelect');
    considerPartnerDownCheckbox = document.getElementById('considerPartnerDownCheckbox');

    // ★新しいセレクタの追加とイベントリスナーの追加★
    subAccordionHeaders = document.querySelectorAll('.sub-accordion-header');

    // ★覚醒ゲージ計算詳細の数値を動的に挿入する処理を追加★
    // 注意: これらの要素はDOMがロードされた直後（DOMContentLoaded時）に存在するため、ここで値を設定できます。
    // サブアコーディオンが展開されるたびに更新する必要がある場合は、別途関数化してアコーディオン開閉イベントに紐付けます。
    // 今回は初期ロード時に設定する方針で実装します。
    if (document.getElementById('avgGaugeCoeffValue')) {
        document.getElementById('avgGaugeCoeffValue').textContent = AVERAGE_GAUGE_COEFFICIENT.toFixed(3);
        document.getElementById('avgGaugeCoeffExampleValue').textContent = AVERAGE_GAUGE_COEFFICIENT.toFixed(3); // ヒントの例にも適用
    }
    if (document.getElementById('ownDownBonus30')) document.getElementById('ownDownBonus30').textContent = AWAKENING_BONUS_BY_COST["3.0"];
    if (document.getElementById('ownDownBonus20')) document.getElementById('ownDownBonus20').textContent = AWAKENING_BONUS_BY_COST["2.0"];
    if (document.getElementById('ownDownBonus15')) document.getElementById('ownDownBonus15').textContent = AWAKENING_BONUS_BY_COST["1.5"];
    if (document.getElementById('partnerDownBonus30')) document.getElementById('partnerDownBonus30').textContent = PARTNER_DOWN_AWAKENING_BONUS["3.0"];
    if (document.getElementById('partnerDownBonus25')) document.getElementById('partnerDownBonus25').textContent = PARTNER_DOWN_AWAKENING_BONUS["2.5"];
    if (document.getElementById('partnerDownBonus20')) document.getElementById('partnerDownBonus20').textContent = PARTNER_DOWN_AWAKENING_BONUS["2.0"];
    if (document.getElementById('partnerDownBonus15')) document.getElementById('partnerDownBonus15').textContent = PARTNER_DOWN_AWAKENING_BONUS["1.5"];
    if (document.getElementById('awakeningThresholdValue')) document.getElementById('awakeningThresholdValue').textContent = AWAKENING_THRESHOLD;


    // 初期設定の関数呼び出し (アニメーションより先にデータを準備)
    populateCharacterSelects();
    populateRemainingCostSelect();
    updateTeamCost(); // selectsがpopulateされた後に呼ぶ
    updateSelectedCharactersDisplay(); // selectsがpopulateされた後に呼ぶ
    resetSimulationResults(); // 初期表示をクリーンに保つ

    [ beforeShotdownAwakeningGaugeInput, beforeShotdownHpInput_damageTakenInput, damageDealtAwakeningBonusSelect, considerOwnDownCheckbox, considerPartnerDownCheckbox, considerDamageDealtCheckbox ].forEach(el => {
        if (el) {
            if (el.type === 'checkbox' || el.tagName === 'SELECT') el.addEventListener('change', calculateAndDisplayAwakeningGauge);
            else el.addEventListener('input', calculateAndDisplayAwakeningGauge);
        }
    });
    if(considerDamageDealtCheckbox && damageDealtOptionsContainer) {
        considerDamageDealtCheckbox.addEventListener('change', function() {
            damageDealtOptionsContainer.style.display = this.checked ? 'block' : 'none';
            if (!this.checked && damageDealtAwakeningBonusSelect) damageDealtAwakeningBonusSelect.value = "0";
        });
    }

    const tl = gsap.timeline({ defaults: { opacity: 0, ease: "power3.out", overwrite: true } });
    tl.from("h1", { y: -50, duration: 1, scale: 0.8, delay: 0.5 })
        .from(".usage-guide-container", { y: 50, duration: 0.8 }, "-=0.5")
        .from(".simulation-container", { y: 50, duration: 0.8 }, "-=0.4")
        .from(".total-hp-display-area", { y: 50, duration: 0.8 }, "-=0.3")
        .from(".controls-container", { y: 50, duration: 0.7 }, "-=0.4")
        .add(initSearchIconPulseAnimation)
        .add(applyFiltersAndSearch); // updateSortIconsの呼び出しを削除


    let isComposing = false; let searchTimeoutLocal;
    if(characterSearchInput) {
        characterSearchInput.addEventListener('compositionstart', () => { isComposing = true; clearTimeout(searchTimeoutLocal); });
        characterSearchInput.addEventListener('compositionend', () => { isComposing = false; clearTimeout(searchTimeoutLocal); applyFiltersAndSearch(); });
        characterSearchInput.addEventListener('input', () => { if (!isComposing) { clearTimeout(searchTimeoutLocal); searchTimeoutLocal = setTimeout(applyFiltersAndSearch, 300); }});
        characterSearchInput.addEventListener('blur', () => { if (!isComposing) { clearTimeout(searchTimeoutLocal); applyFiltersAndSearch(); }});
    }
    if(costFilterButtons) costFilterButtons.forEach(button => button.addEventListener('click', () => { costFilterButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); applyFiltersAndSearch(); }));
    if(sortFilterButtons) sortFilterButtons.forEach(button => button.addEventListener('click', () => { sortFilterButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); applyFiltersAndSearch(); })); // updateSortIconsの呼び出しを削除
    if(accordionHeaders) {
        accordionHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const content = this.nextElementSibling; const isExpanded = this.getAttribute('aria-expanded') === 'true';
                this.setAttribute('aria-expanded', !isExpanded); this.classList.toggle('active'); content.classList.toggle('show');
                if (!isExpanded) gsap.to(content, { maxHeight: content.scrollHeight + "px", paddingTop: "25px", paddingBottom: "25px", opacity: 1, scaleY: 1, duration: 0.4, ease: "cubic-bezier(0.25, 0.46, 0.45, 0.94)"});
                else gsap.to(content, { maxHeight: 0, paddingTop: 0, paddingBottom: 0, opacity: 0, scaleY: 0.8, duration: 0.4, ease: "cubic-bezier(0.25, 0.46, 0.45, 0.94)"});
            });
        });
    }

    // ★サブアコーディオンのイベントリスナーを追加★
    if(subAccordionHeaders) {
        subAccordionHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const content = this.nextElementSibling;
                const isExpanded = this.getAttribute('aria-expanded') === 'true';

                // 開閉アニメーション
                this.setAttribute('aria-expanded', !isExpanded);
                this.classList.toggle('active');
                content.classList.toggle('show');

                if (!isExpanded) {
                    // 開く
                    gsap.to(content, {
                        maxHeight: content.scrollHeight + "px",
                        paddingTop: "20px", // サブアコーディオンのパディングに合わせて調整
                        paddingBottom: "20px", // サブアコーディオンのパディングに合わせて調整
                        opacity: 1,
                        scaleY: 1,
                        duration: 0.4,
                        ease: "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                    });
                } else {
                    // 閉じる
                    gsap.to(content, {
                        maxHeight: 0,
                        paddingTop: 0,
                        paddingBottom: 0,
                        opacity: 0,
                        scaleY: 0.8,
                        duration: 0.4,
                        ease: "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                    });
                }
            });
        });
    }
    const totalHpAccordionHeaders = document.querySelectorAll('.total-hp-accordion-header');
    if (totalHpAccordionHeaders) {
        totalHpAccordionHeaders.forEach(header => {
            header.addEventListener('click', function() {
                this.classList.toggle('active'); this.setAttribute('aria-expanded', this.classList.contains('active'));
                const content = this.nextElementSibling; const isShown = content.classList.toggle('show');
                if (isShown) gsap.to(content, { maxHeight: "300px", opacity: 1, paddingTop: "8px", paddingBottom: "8px", marginTop: "10px", borderWidth: "1px", duration: 0.4, ease: "power2.out" });
                else gsap.to(content, { maxHeight: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, borderWidth: "0px", duration: 0.4, ease: "power2.in" });
            });
        });
    }

    if(characterGrid) {
        characterGrid.addEventListener('click', (event) => {
            const clickedElement = event.target;
            const card = clickedElement.closest('.character-card');
            if (!card) return;

            const originalHp = parseFloat(card.dataset.originalHp);
            const clickedRedeployCell = clickedElement.closest('.cost-table td[data-redeploy-hp]');

            if (clickedRedeployCell) {
                animateHpDisplay(card, parseFloat(clickedRedeployCell.dataset.redeployHp));
            } else if (clickedElement.classList.contains('character-hp')) {
                animateHpDisplay(card, originalHp);
            }
        });
    }


    if(simulatePlayerRedeployBtn) simulatePlayerRedeployBtn.addEventListener('click', () => simulateRedeploy('player'));
    if(simulatePartnerRedeployBtn) simulatePartnerRedeployBtn.addEventListener('click', () => simulateRedeploy('partner'));
    if(playerCharSelect) playerCharSelect.addEventListener('change', (event) => { selectedPlayerChar = event.target.value ? characterData[parseInt(event.target.value)] : null; updateTeamCost(); updateSelectedCharactersDisplay(); });
    if(partnerCharSelect) partnerCharSelect.addEventListener('change', (event) => { selectedPartnerChar = event.target.value ? characterData[parseInt(event.target.value)] : null; updateTeamCost(); updateSelectedCharactersDisplay(); });
});