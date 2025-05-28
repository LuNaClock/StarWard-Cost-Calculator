// GSAPはグローバルスコープから使用します (index.htmlでCDN読み込み)
// import gsap from 'gsap'; // この行は削除

import * as DOM from './domElements.js';
import { costRemainingMap, AVERAGE_GAUGE_COEFFICIENT, AWAKENING_BONUS_BY_COST, PARTNER_DOWN_AWAKENING_BONUS, AWAKENING_THRESHOLD } from '../data.js';
import { getCharacters, getSelectedPlayerChar, getSelectedPartnerChar } from './state.js';

export function showLoading() {
    if (DOM.loadingOverlay) DOM.loadingOverlay.classList.add('active');
}

export function hideLoading() {
    if (DOM.loadingOverlay) gsap.to(DOM.loadingOverlay, { opacity: 0, duration: 0.3, onComplete: () => DOM.loadingOverlay.classList.remove('active') });
}

export function generateCharacterCards(charactersToDisplay) {
    showLoading();
    gsap.to(Array.from(DOM.characterGrid.children), {
        opacity: 0, scale: 0.8, y: 50, duration: 0.2, stagger: 0.01, ease: "power2.in", overwrite: true,
        onComplete: () => {
            DOM.characterGrid.innerHTML = '';
            if (charactersToDisplay.length === 0) {
                const noResultsMessage = document.createElement('p');
                noResultsMessage.className = 'no-results-message';
                noResultsMessage.textContent = 'ERROR: NO DATA FOUND';
                DOM.characterGrid.appendChild(noResultsMessage);
                gsap.fromTo(noResultsMessage, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out", delay: 0.1 });
                // animation: 'glitchDisplay 2s ease-in-out forwards' はCSS側で .no-results-message に適用されている想定
                hideLoading();
                return;
            }
            charactersToDisplay.forEach((character, index) => {
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
                            <tbody><tr><td>再出撃時耐久値</td>${costOverHPs.map((hp) => `<td data-redeploy-hp="${hp}">${hp.toLocaleString()}</td>`).join('')}</tr></tbody>
                        </table>
                    </div>`;
                DOM.characterGrid.appendChild(card);
                const imgElement = card.querySelector('.character-icon-img');
                const initialSpan = card.querySelector('.initial');
                if (character.image) {
                    imgElement.onload = () => { imgElement.style.display = 'block'; initialSpan.style.display = 'none'; };
                    imgElement.onerror = () => { imgElement.style.display = 'none'; initialSpan.style.display = 'flex'; };
                    imgElement.src = character.image;
                     if (imgElement.complete && imgElement.naturalWidth > 0) { // Check if image is already loaded from cache
                        imgElement.style.display = 'block'; initialSpan.style.display = 'none';
                    }
                } else { imgElement.style.display = 'none'; initialSpan.style.display = 'flex'; }
                gsap.from(card, { opacity: 0, y: 80, scale: 0.8, rotateZ: gsap.utils.random(-5, 5), duration: 0.4, ease: "power3.out", delay: index * 0.02, overwrite: true });
            });
            hideLoading();
        }
    });
}

export function animateHpDisplayOnCard(card, targetHp) {
    const hpBarFill = card.querySelector('.hp-bar-fill');
    const originalHp = parseFloat(card.dataset.originalHp);
    const currentHpSpan = card.querySelector('.character-hp');
    const hpPercentageDisplayElement = card.querySelector('.hp-percentage-display');
    const allRedeployCellsInCard = card.querySelectorAll('.cost-table td[data-redeploy-hp]');

    gsap.killTweensOf(currentHpSpan); // 現在のHP数値のアニメーションを停止
    gsap.set(currentHpSpan, { color: '#E74C3C', textShadow: '0 0 5px rgba(231, 76, 60, 0.3)' }); // デフォルトのスタイルにリセット
    currentHpSpan.textContent = originalHp.toLocaleString(); // 元のHPを表示
    currentHpSpan.classList.remove('animating'); // アニメーションクラスを削除
    gsap.killTweensOf(hpBarFill); // HPバーのアニメーションを停止

    if (targetHp === originalHp) {
        gsap.to(hpBarFill, { scaleX: 1, duration: 0.8, ease: "power3.out", transformOrigin: 'left center', overwrite: true });
        hpBarFill.classList.remove('hp-bar-low-pulse');
        allRedeployCellsInCard.forEach(cell => cell.classList.remove('active-hp-display'));
        currentHpSpan.classList.add('animating'); // HP数値にポップアニメーション
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
        currentHpSpan.classList.add('animating'); // HP数値にポップアニメーション
        gsap.delayedCall(0.8, () => currentHpSpan.classList.remove('animating'));
        if (hpPercentageDisplayElement) {
            hpPercentageDisplayElement.classList.add('show');
            // onUpdateで設定されるが、念のためここでも最終値を設定
            hpPercentageDisplayElement.textContent = `${Math.round(hpPercentage * 100)}%`;
        }
        allRedeployCellsInCard.forEach(cell => cell.classList.remove('active-hp-display'));
        const clickedCell = Array.from(allRedeployCellsInCard).find(cell => parseFloat(cell.dataset.redeployHp) === targetHp);
        if (clickedCell) clickedCell.classList.add('active-hp-display');
    }
}

let searchIconPulseTl;
export function initSearchIconPulseAnimation() {
    searchIconPulseTl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 1.8, ease: "power2.inOut", overwrite: true } });
    if (DOM.searchIcon) searchIconPulseTl.to(DOM.searchIcon, { scale: 1.08, opacity: 1 });
}

export function populateCharacterSelects() {
    const characters = getCharacters();
    const defaultOption = '<option value="">-- 選択してください --</option>';
    DOM.playerCharSelect.innerHTML = defaultOption;
    DOM.partnerCharSelect.innerHTML = defaultOption;
    characters.forEach((char, index) => {
        const option = `<option value="${index}">${char.name} (コスト:${char.cost.toFixed(1)})</option>`;
        DOM.playerCharSelect.innerHTML += option;
        DOM.partnerCharSelect.innerHTML += option;
    });
}

export function populateRemainingCostSelect(maxTeamCost) {
    DOM.remainingTeamCostInput.innerHTML = '';
    const zeroOption = document.createElement('option');
    zeroOption.value = "0.0";
    zeroOption.textContent = "0.0";
    DOM.remainingTeamCostInput.appendChild(zeroOption);
    for (let cost = 0.5; cost <= maxTeamCost; cost += 0.5) {
        const option = document.createElement('option');
        option.value = cost.toFixed(1);
        option.textContent = cost.toFixed(1);
        DOM.remainingTeamCostInput.appendChild(option);
    }
}

export function updateSelectedCharactersDisplay() {
    const selectedPlayerChar = getSelectedPlayerChar();
    const selectedPartnerChar = getSelectedPartnerChar();
    DOM.selectedCharsDisplay.innerHTML = '';

    const createMiniCard = (character) => {
        const miniCard = document.createElement('div');
        miniCard.className = 'mini-character-card active'; // Initially active for animation
        miniCard.innerHTML = `
            <div class="char-name">${character.name}</div>
            <div class="char-image">
                <img src="${character.image || ''}" alt="${character.name}" class="mini-char-img" style="display: ${character.image ? 'block' : 'none'};">
                <span class="initial" style="display: ${character.image ? 'none' : 'flex'};">${character.name.charAt(0)}</span>
            </div>
            <div class="char-cost">コスト: ${character.cost.toFixed(1)}</div>`;
        const imgElement = miniCard.querySelector('.mini-char-img');
        const initialSpan = miniCard.querySelector('.initial');
        if (character.image && imgElement) {
            imgElement.onload = () => { imgElement.style.display = 'block'; if(initialSpan) initialSpan.style.display = 'none'; };
            imgElement.onerror = () => { if(imgElement) imgElement.style.display = 'none'; if(initialSpan) initialSpan.style.display = 'flex'; };
            // src must be set after onload/onerror are defined
            imgElement.src = character.image;
            if (imgElement.complete && imgElement.naturalWidth > 0) { // If already cached
                 imgElement.style.display = 'block'; if(initialSpan) initialSpan.style.display = 'none';
            }
        } else if (initialSpan) {
            if(imgElement) imgElement.style.display = 'none';
            initialSpan.style.display = 'flex';
        }
        return miniCard;
    };

    if (selectedPlayerChar) DOM.selectedCharsDisplay.appendChild(createMiniCard(selectedPlayerChar));
    if (selectedPartnerChar) DOM.selectedCharsDisplay.appendChild(createMiniCard(selectedPartnerChar));

    if (!selectedPlayerChar && !selectedPartnerChar) {
        DOM.selectedCharsDisplay.innerHTML = `<p style="color:var(--medium-grey); font-style:italic; margin-top:20px;">自機と相方を選択してください。</p>`;
        gsap.set(DOM.selectedCharsDisplay, { minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' });
    } else {
        gsap.set(DOM.selectedCharsDisplay, { minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }); // Ensure flex properties for centering
    }
}

export function updateTeamCostDisplay(maxTeamCost) {
    const selectedPlayerChar = getSelectedPlayerChar();
    const selectedPartnerChar = getSelectedPartnerChar();
    const playerCost = selectedPlayerChar ? selectedPlayerChar.cost : 0;
    const partnerCost = selectedPartnerChar ? selectedPartnerChar.cost : 0;
    const currentTotalTeamCost = playerCost + partnerCost;
    DOM.totalTeamCostSpan.textContent = currentTotalTeamCost.toFixed(1);

    let autoCalculatedRemainingCost = maxTeamCost - currentTotalTeamCost;
    autoCalculatedRemainingCost = Math.max(0.0, Math.round(autoCalculatedRemainingCost * 2) / 2);
    const targetValue = autoCalculatedRemainingCost.toFixed(1);

    if (Array.from(DOM.remainingTeamCostInput.options).some(opt => opt.value === targetValue)) {
        DOM.remainingTeamCostInput.value = targetValue;
    } else {
        DOM.remainingTeamCostInput.value = "0.0";
    }
}

export function resetSimulationResultsUI() {
    gsap.to(DOM.simulationResultsDiv, {
        opacity: 0, y: 20, duration: 0.3, ease: "power2.in",
        onComplete: () => {
            if (DOM.simulationResultsDiv) DOM.simulationResultsDiv.classList.remove('active');
            if (DOM.redeployCharNameSpan) DOM.redeployCharNameSpan.textContent = '--';
            if (DOM.redeployCharCostSpan) DOM.redeployCharCostSpan.textContent = '--';
            if (DOM.redeployOriginalHpSpan) DOM.redeployOriginalHpSpan.textContent = '--';
            if (DOM.redeployCostConsumedSpan) DOM.redeployCostConsumedSpan.textContent = '--';
            if (DOM.redeployCalculatedHpSpan) DOM.redeployCalculatedHpSpan.textContent = '--';
            if (DOM.simulationHpBarFill) { DOM.simulationHpBarFill.style.transform = 'scaleX(0)'; DOM.simulationHpBarFill.classList.remove('hp-bar-low-pulse');}
            if (DOM.simulationHpPercentageDisplay) { DOM.simulationHpPercentageDisplay.classList.remove('show'); DOM.simulationHpPercentageDisplay.textContent = '';}
            if (DOM.redeployCalculatedHpSpan) { DOM.redeployCalculatedHpSpan.classList.remove('low-hp-value', 'red-value');}

            if (DOM.awakeningSimulationArea) DOM.awakeningSimulationArea.style.display = 'none';
            if (DOM.beforeShotdownAwakeningGaugeInput) DOM.beforeShotdownAwakeningGaugeInput.value = 0;
            if (DOM.beforeShotdownHpInput_damageTakenInput) { DOM.beforeShotdownHpInput_damageTakenInput.value = 0; DOM.beforeShotdownHpInput_damageTakenInput.style.borderColor = '';}
            if(DOM.considerOwnDownCheckbox) DOM.considerOwnDownCheckbox.checked = false;
            if (DOM.considerDamageDealtCheckbox) {
                DOM.considerDamageDealtCheckbox.checked = false;
                if(DOM.damageDealtOptionsContainer) DOM.damageDealtOptionsContainer.style.display = 'none';
                if(DOM.damageDealtAwakeningBonusSelect) DOM.damageDealtAwakeningBonusSelect.value = "0";
            }
            if (DOM.considerPartnerDownCheckbox) DOM.considerPartnerDownCheckbox.checked = false;
            if (DOM.predictedAwakeningGaugeSpan) DOM.predictedAwakeningGaugeSpan.textContent = '--';
            if (DOM.awakeningAvailabilitySpan) { DOM.awakeningAvailabilitySpan.textContent = '--'; DOM.awakeningAvailabilitySpan.className = 'info-value';}
        }
    });
}

export function displayTotalTeamHpResults(scenarios) {
    const selectedPlayerChar = getSelectedPlayerChar();
    const selectedPartnerChar = getSelectedPartnerChar();

    if (!scenarios) {
         gsap.to(DOM.totalHpDisplayArea, { opacity: 0, y: 20, duration: 0.3, ease: "power2.in", onComplete: () => {
            if(DOM.totalHpDisplayArea) DOM.totalHpDisplayArea.classList.remove('active'); // Hide it
            if (DOM.highestHpScenarioTitleSpan) DOM.highestHpScenarioTitleSpan.textContent = 'チーム合計耐久値(最高)';
            if (DOM.idealGainedHpSpan) DOM.idealGainedHpSpan.textContent = '--';
            if (DOM.idealSequenceList) DOM.idealSequenceList.innerHTML = '';
            if (DOM.compromiseHpScenarioTitleSpan) DOM.compromiseHpScenarioTitleSpan.textContent = 'チーム合計耐久値(妥協)';
            if (DOM.minGainedHpHpSpan) DOM.minGainedHpHpSpan.textContent = '--';
            if (DOM.minSequenceList) DOM.minSequenceList.innerHTML = '';
            if (DOM.bombHpScenarioTitleSpan) DOM.bombHpScenarioTitleSpan.textContent = 'チーム合計耐久値(爆弾)';
            if (DOM.bombGainedHpSpan) DOM.bombGainedHpSpan.textContent = '--';
            if (DOM.bombSequenceList) DOM.bombSequenceList.innerHTML = '';
            if (DOM.lowestHpScenarioTitleSpan) DOM.lowestHpScenarioTitleSpan.textContent = 'チーム合計耐久値(最低)';
            if (DOM.lowestGainedHpSpan) DOM.lowestGainedHpSpan.textContent = '--';
            if (DOM.lowestSequenceList) DOM.lowestSequenceList.innerHTML = '';
        }});
        return;
    }

    const { idealScenario, compromiseScenario, bombScenario, lowestScenario } = scenarios;

    if (DOM.selectedPlayerCharNameSummary && selectedPlayerChar) DOM.selectedPlayerCharNameSummary.textContent = selectedPlayerChar.name;
    if (DOM.selectedPartnerCharNameSummary && selectedPartnerChar) DOM.selectedPartnerCharNameSummary.textContent = selectedPartnerChar.name;

    if (DOM.totalHpDisplayArea) {
        DOM.totalHpDisplayArea.classList.add('active'); // Make it visible for GSAP
        gsap.to(DOM.totalHpDisplayArea, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
    } else return;

    const generateListItems = (sequence) => {
        return sequence?.map(item => {
            const charTypeDisplay = item.charType ? ` (${item.charType})` : '';
            let processedNote = item.note;
            const regexToReplace = /\((\d+\.\d+)コスト換算\), 消費後実質コストオーバー\((\d+\.\d+)換算\)/;
            processedNote = processedNote.replace(regexToReplace, `コストオーバー($2換算)`);
            const remainingCostDisplay = item.remainingCost !== undefined ? `, 残り: ${item.remainingCost}` : '';
            return `<li>${item.turn}落ち: ${item.charName}${charTypeDisplay} - ${item.hpGained.toLocaleString()} HP獲得 (${processedNote}${remainingCostDisplay})</li>`;
        }).join('') || '';
    };

    if(DOM.highestHpScenarioTitleSpan) DOM.highestHpScenarioTitleSpan.textContent = idealScenario.name;
    if(DOM.idealGainedHpSpan) DOM.idealGainedHpSpan.textContent = idealScenario.totalHp?.toLocaleString() || '--';
    if(DOM.idealSequenceList) DOM.idealSequenceList.innerHTML = generateListItems(idealScenario.sequence);

    if(DOM.compromiseHpScenarioTitleSpan) DOM.compromiseHpScenarioTitleSpan.textContent = compromiseScenario.name;
    if(DOM.minGainedHpHpSpan) DOM.minGainedHpHpSpan.textContent = compromiseScenario.totalHp?.toLocaleString() || '--';
    if(DOM.minSequenceList) DOM.minSequenceList.innerHTML = generateListItems(compromiseScenario.sequence);

    if(DOM.bombHpScenarioTitleSpan) DOM.bombHpScenarioTitleSpan.textContent = bombScenario.name;
    if(DOM.bombGainedHpSpan) DOM.bombGainedHpSpan.textContent = bombScenario.totalHp?.toLocaleString() || '--';
    if(DOM.bombSequenceList) DOM.bombSequenceList.innerHTML = generateListItems(bombScenario.sequence);

    if(DOM.lowestHpScenarioTitleSpan) DOM.lowestHpScenarioTitleSpan.textContent = lowestScenario.name;
    if(DOM.lowestGainedHpSpan) DOM.lowestGainedHpSpan.textContent = lowestScenario.totalHp?.toLocaleString() || '--';
    if(DOM.lowestSequenceList) DOM.lowestSequenceList.innerHTML = generateListItems(lowestScenario.sequence);
}


export function updateRedeploySimulationUI(charToRedeploy, calculatedHp, actualCostConsumed) {
    DOM.redeployCharNameSpan.textContent = charToRedeploy.name;
    DOM.redeployCharCostSpan.textContent = charToRedeploy.cost.toFixed(1);
    DOM.redeployOriginalHpSpan.textContent = charToRedeploy.hp.toLocaleString();
    DOM.redeployCostConsumedSpan.textContent = actualCostConsumed.toFixed(1);
    DOM.redeployCalculatedHpSpan.textContent = calculatedHp.toLocaleString();

    const originalHpValue = charToRedeploy.hp;
    DOM.redeployCalculatedHpSpan.classList.remove('red-value', 'low-hp-value');
    if (originalHpValue > 0 && calculatedHp < originalHpValue && calculatedHp > 0) {
        DOM.redeployCalculatedHpSpan.classList.add('red-value');
    } else if (calculatedHp === 0 && originalHpValue > 0) {
        DOM.redeployCalculatedHpSpan.classList.add('red-value');
    }

    const hpPercentage = originalHpValue > 0 ? (calculatedHp / originalHpValue) : 0;
    gsap.to(DOM.simulationHpBarFill, {
        scaleX: hpPercentage, duration: 0.8, ease: "power3.out", transformOrigin: 'left center', overwrite: true,
        onUpdate: () => { if (DOM.simulationHpPercentageDisplay) DOM.simulationHpPercentageDisplay.textContent = `${Math.round(gsap.getProperty(DOM.simulationHpBarFill, "scaleX") * 100)}%`; },
        onComplete: () => { if (DOM.simulationHpPercentageDisplay) DOM.simulationHpPercentageDisplay.textContent = `${Math.round(hpPercentage * 100)}%`; }
    });

    if (hpPercentage <= 0.3) DOM.simulationHpBarFill.classList.add('hp-bar-low-pulse');
    else DOM.simulationHpBarFill.classList.remove('hp-bar-low-pulse');

    if (DOM.simulationHpPercentageDisplay) DOM.simulationHpPercentageDisplay.classList.add('show');

    if (DOM.simulationResultsDiv) { // Ensure simulationResultsDiv is not null
        DOM.simulationResultsDiv.classList.add('active'); // Make it visible for GSAP
        gsap.fromTo(DOM.simulationResultsDiv, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", onComplete: () => {
            if (DOM.awakeningSimulationArea) DOM.awakeningSimulationArea.style.display = 'block';
        }});
    }
}

export function updateAwakeningGaugeUI(gaugeResult) {
    if (gaugeResult.error) {
        DOM.predictedAwakeningGaugeSpan.textContent = '---';
        DOM.awakeningAvailabilitySpan.textContent = '--';
        DOM.awakeningAvailabilitySpan.className = 'info-value';
        if(DOM.beforeShotdownHpInput_damageTakenInput) DOM.beforeShotdownHpInput_damageTakenInput.style.borderColor = 'red';
        return;
    }

    if(DOM.beforeShotdownHpInput_damageTakenInput) {
        DOM.beforeShotdownHpInput_damageTakenInput.style.borderColor = '';
        if (DOM.beforeShotdownHpInput_damageTakenInput.value !== gaugeResult.validatedDamageTaken.toString()) {
             DOM.beforeShotdownHpInput_damageTakenInput.value = gaugeResult.validatedDamageTaken;
        }
    }

    DOM.predictedAwakeningGaugeSpan.textContent = gaugeResult.finalPredictedGauge;
    DOM.awakeningAvailabilitySpan.classList.remove('awakening-possible', 'awakening-not-possible');
    if (gaugeResult.isThresholdMet) {
        DOM.awakeningAvailabilitySpan.textContent = '使用可能';
        DOM.awakeningAvailabilitySpan.classList.add('awakening-possible');
    } else {
        DOM.awakeningAvailabilitySpan.textContent = '使用不可';
        DOM.awakeningAvailabilitySpan.classList.add('awakening-not-possible');
    }
}


export function toggleAccordion(headerElement, contentElement, isSubAccordion = false) {
    const isExpanded = headerElement.getAttribute('aria-expanded') === 'true';
    headerElement.setAttribute('aria-expanded', String(!isExpanded));
    headerElement.classList.toggle('active');
    contentElement.classList.toggle('show');

    const padding = isSubAccordion ? "20px" : "25px";

    if (!isExpanded) { // Opening
        gsap.to(contentElement, {
            maxHeight: contentElement.scrollHeight + "px",
            paddingTop: padding,
            paddingBottom: padding,
            opacity: 1,
            scaleY: 1,
            duration: 0.4,
            ease: "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
        });
    } else { // Closing
        gsap.to(contentElement, {
            maxHeight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            opacity: 0,
            scaleY: 0.8,
            duration: 0.4,
            ease: "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
        });
    }
}

export function toggleTotalHpAccordion(headerElement, contentElement) {
    headerElement.classList.toggle('active');
    headerElement.setAttribute('aria-expanded', String(headerElement.classList.contains('active')));
    const isShown = contentElement.classList.toggle('show');

    if (isShown) {
        gsap.to(contentElement, { maxHeight: "300px", opacity: 1, paddingTop: "8px", paddingBottom: "8px", marginTop: "10px", borderWidth: "1px", duration: 0.4, ease: "power2.out" });
    } else {
        gsap.to(contentElement, { maxHeight: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, borderWidth: "0px", duration: 0.4, ease: "power2.in" });
    }
}


export function initPageAnimations() {
    const tl = gsap.timeline({ defaults: { opacity: 0, ease: "power3.out", overwrite: true } });
    tl.from("h1", { y: -50, duration: 1, scale: 0.8, delay: 0.5 })
        .from(".usage-guide-container", { y: 50, duration: 0.8 }, "-=0.5")
        .from(".simulation-container", { y: 50, duration: 0.8 }, "-=0.4")
        // .from(".total-hp-display-area", { y: 50, duration: 0.8 }, "-=0.3") // 初期非表示なのでアニメーション対象外に
        .from(".controls-container", { y: 50, duration: 0.7 }, "-=0.4")
        .add(initSearchIconPulseAnimation);
}

export function setAwakeningDetailsConstants() {
    if (DOM.avgGaugeCoeffValueSpan) DOM.avgGaugeCoeffValueSpan.textContent = AVERAGE_GAUGE_COEFFICIENT.toFixed(3);
    if (DOM.avgGaugeCoeffExampleValueSpan) DOM.avgGaugeCoeffExampleValueSpan.textContent = AVERAGE_GAUGE_COEFFICIENT.toFixed(3);
    if (DOM.ownDownBonus30Span) DOM.ownDownBonus30Span.textContent = AWAKENING_BONUS_BY_COST["3.0"];
    if (DOM.ownDownBonus20Span) DOM.ownDownBonus20Span.textContent = AWAKENING_BONUS_BY_COST["2.0"];
    if (DOM.ownDownBonus15Span) DOM.ownDownBonus15Span.textContent = AWAKENING_BONUS_BY_COST["1.5"];
    if (DOM.partnerDownBonus30Span) DOM.partnerDownBonus30Span.textContent = PARTNER_DOWN_AWAKENING_BONUS["3.0"];
    if (DOM.partnerDownBonus25Span) DOM.partnerDownBonus25Span.textContent = PARTNER_DOWN_AWAKENING_BONUS["2.5"];
    if (DOM.partnerDownBonus20Span) DOM.partnerDownBonus20Span.textContent = PARTNER_DOWN_AWAKENING_BONUS["2.0"];
    if (DOM.partnerDownBonus15Span) DOM.partnerDownBonus15Span.textContent = PARTNER_DOWN_AWAKENING_BONUS["1.5"];
    if (DOM.awakeningThresholdValueSpan) DOM.awakeningThresholdValueSpan.textContent = AWAKENING_THRESHOLD;
}