import {
    MAX_TEAM_COST,
    AVERAGE_GAUGE_COEFFICIENT,
    AWAKENING_THRESHOLD,
    AWAKENING_BONUS_BY_COST,
    PARTNER_DOWN_AWAKENING_BONUS
} from '../data.js';
import { getSelectedPlayerChar, getSelectedPartnerChar } from './state.js';

function getCharacterType(character, selectedPlayerChar) {
    return character === selectedPlayerChar ? "自機" : "相方";
}

export function calculateRedeployEffect(charToRedeploy, partnerChar, currentTeamCostRemaining, currentRedeployCount, isTeamHpScenario = false) {
    // Validate inputs
    if (!charToRedeploy || typeof charToRedeploy.cost !== 'number' || typeof charToRedeploy.hp !== 'number' ||
        typeof currentTeamCostRemaining !== 'number' || typeof currentRedeployCount !== 'number') {
        // console.error("Invalid arguments for calculateRedeployEffect", {charToRedeploy, currentTeamCostRemaining, currentRedeployCount});
        return { hpGained: 0, costConsumed: 0, note: "計算エラー", remainingCostAfterConsumption: currentTeamCostRemaining };
    }


    const charFullCost = charToRedeploy.cost;
    const originalHp = charToRedeploy.hp;
    let calculatedHpGained = 0;
    let costActuallyConsumed = 0;
    let teamCostAfterConsumption = currentTeamCostRemaining;
    const noteParts = [];
    let finalNote = "";

    if (currentTeamCostRemaining < 0.001) {
        calculatedHpGained = 0;
        costActuallyConsumed = 0;
        finalNote = "チームコスト0のため出撃不可";
        return { hpGained: calculatedHpGained, costConsumed: costActuallyConsumed, note: finalNote, remainingCostAfterConsumption: currentTeamCostRemaining };
    }

    let costUsedForHpCalculationBase;

    if (isTeamHpScenario) {
        let hypotheticalRemainingCostAfterOwnFullCostConsumption = currentTeamCostRemaining - charFullCost;
        costUsedForHpCalculationBase = Math.max(0, hypotheticalRemainingCostAfterOwnFullCostConsumption);
        costUsedForHpCalculationBase = Math.min(costUsedForHpCalculationBase, charFullCost);
    } else {
        costUsedForHpCalculationBase = currentTeamCostRemaining;
    }

    let effectiveCostForHpCalculation = Math.min(costUsedForHpCalculationBase, charFullCost);
    if (effectiveCostForHpCalculation < 0) effectiveCostForHpCalculation = 0; 

    if (charFullCost <= 0) { 
        calculatedHpGained = 0;
    } else {
        calculatedHpGained = Math.round(originalHp * (effectiveCostForHpCalculation / charFullCost));
    }
    
    let costOverConversionValue = null;

    if (currentTeamCostRemaining >= charFullCost) {
        costActuallyConsumed = charFullCost;
        if (effectiveCostForHpCalculation < charFullCost && effectiveCostForHpCalculation >= 0) {
            costOverConversionValue = effectiveCostForHpCalculation;
            noteParts.push("コストオーバー");
        }
    } else {
        costActuallyConsumed = currentTeamCostRemaining;
        costOverConversionValue = currentTeamCostRemaining;
        noteParts.push("コストオーバー");
    }
    teamCostAfterConsumption = Math.max(0.0, currentTeamCostRemaining - costActuallyConsumed);

    if (costOverConversionValue !== null) {
        const costOverIndex = noteParts.findIndex(part => part.includes("コストオーバー"));
        if (costOverIndex !== -1) {
            noteParts[costOverIndex] = `${noteParts[costOverIndex]} (${costOverConversionValue.toFixed(1)}コスト換算)`;
        }
    }

    if (isTeamHpScenario && currentTeamCostRemaining >= charFullCost && costActuallyConsumed === charFullCost && teamCostAfterConsumption < charFullCost && teamCostAfterConsumption > 0.0001) {
        const hasCostOverNote = noteParts.some(part => part.includes("コストオーバー"));
        if (!hasCostOverNote) {
            noteParts.push(`消費後実質コストオーバー(${teamCostAfterConsumption.toFixed(1)}換算)`);
        }
    }

    if (teamCostAfterConsumption < 0.001) {
        const hasZeroCostNote = noteParts.some(part => part.includes("最終残りコスト0のためHP0"));
        if (!hasZeroCostNote) {
            noteParts.push("最終残りコスト0のためHP0");
        }
    }

    finalNote = noteParts.join(", ");

    if (currentTeamCostRemaining < 0.001 && costActuallyConsumed == 0 && finalNote !== "チームコスト0のため出撃不可") {
         finalNote = "チームコスト0のため出撃不可";
         calculatedHpGained = 0;
    }
    return { hpGained: calculatedHpGained, costConsumed: costActuallyConsumed, note: finalNote, remainingCostAfterConsumption: teamCostAfterConsumption };
}


function simulateRemainingSequenceContinuous(fallingChar, initialRemainingCost, fallCountOfThisCharBeforeThisSubsequence, isTeamScenario, selectedPlayerChar) {
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
            turn: attemptsInSub, charName: fallingChar.name, charType: getCharacterType(fallingChar, selectedPlayerChar),
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

function simulateRemainingSequenceAlternating(charA, charB, initialRemainingCost, fallCountA_before, fallCountB_before, isTeamScenario, selectedPlayerChar) {
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
            turn: attemptsInSub, charName: charToRedeploy.name, charType: getCharacterType(charToRedeploy, selectedPlayerChar),
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

function simulateMinimumSequence(fallingChar, isTeamScenario, selectedPlayerChar) {
    let currentTeamCostRemaining = MAX_TEAM_COST;
    let totalGainedRedeployHp = 0;
    let redeployCountForThisCharInSequence = 0;
    const sequence = [];
    const maxRedeployAttempts = 10;
    let attempts = 0;

    while (currentTeamCostRemaining >= 0.001 && attempts < maxRedeployAttempts) {
        attempts++;
        let result = calculateRedeployEffect(fallingChar, null, currentTeamCostRemaining, redeployCountForThisCharInSequence, isTeamScenario);
        if (result.note.includes("出撃不可") && result.hpGained <= 0 && result.costConsumed <= 0 && currentTeamCostRemaining < 0.001 && attempts > 1) break;

        sequence.push({
            turn: redeployCountForThisCharInSequence + 1,
            charName: fallingChar.name,
            charType: getCharacterType(fallingChar, selectedPlayerChar),
            charCost: fallingChar.cost,
            hpGained: result.hpGained,
            costConsumed: result.costConsumed,
            remainingCost: result.remainingCostAfterConsumption.toFixed(1),
            note: result.note
        });
        totalGainedRedeployHp += result.hpGained;
        currentTeamCostRemaining = result.remainingCostAfterConsumption;
        redeployCountForThisCharInSequence++;
        if (result.note.includes("出撃不可") && result.hpGained <= 0 && result.costConsumed <= 0 && currentTeamCostRemaining < 0.001) break;
    }
    return { totalHp: totalGainedRedeployHp, sequence: sequence };
}


function calculateTeamHpScenariosInternal(selectedPlayerChar, selectedPartnerChar) {
    if (!selectedPlayerChar || !selectedPartnerChar) {
        return null;
    }
    const IS_TEAM_SCENARIO = true;

    // Highest HP Scenario
    let firstFallChar_highest, secondFallChar_highest;
    if (selectedPlayerChar.cost > selectedPartnerChar.cost) { firstFallChar_highest = selectedPlayerChar; secondFallChar_highest = selectedPartnerChar; }
    else if (selectedPartnerChar.cost > selectedPlayerChar.cost) { firstFallChar_highest = selectedPartnerChar; secondFallChar_highest = selectedPlayerChar; }
    else { if (selectedPlayerChar.hp >= selectedPartnerChar.hp) { firstFallChar_highest = selectedPlayerChar; secondFallChar_highest = selectedPartnerChar; }
           else { firstFallChar_highest = selectedPartnerChar; secondFallChar_highest = selectedPlayerChar; } }

    let currentHpForHighest = selectedPlayerChar.hp + selectedPartnerChar.hp;
    let currentCostForHighest = MAX_TEAM_COST;
    let highestSequence = [];
    let fallCount_A_highest = 0; let fallCount_B_highest = 0; let currentTurn_highest = 0;
    highestSequence.push({ turn: currentTurn_highest++, charName: "初期HP", charType: "", charCost: 0, hpGained: currentHpForHighest, costConsumed: 0, remainingCost: currentCostForHighest.toFixed(1), note: `${selectedPlayerChar.name} (${selectedPlayerChar.hp.toLocaleString()}) + ${selectedPartnerChar.name} (${selectedPartnerChar.hp.toLocaleString()})` });

    let res1_highest = calculateRedeployEffect(firstFallChar_highest, null, currentCostForHighest, fallCount_A_highest++, IS_TEAM_SCENARIO);
    currentHpForHighest += res1_highest.hpGained; currentCostForHighest = res1_highest.remainingCostAfterConsumption;
    highestSequence.push({ turn: currentTurn_highest++, charName: firstFallChar_highest.name, charType: getCharacterType(firstFallChar_highest, selectedPlayerChar), charCost: firstFallChar_highest.cost, hpGained: res1_highest.hpGained, costConsumed: res1_highest.costConsumed, remainingCost: currentCostForHighest.toFixed(1), note: res1_highest.note });

    if (currentCostForHighest >= 0.001 && !(res1_highest.note.includes("出撃不可") && res1_highest.hpGained <= 0 && res1_highest.costConsumed <= 0 && currentCostForHighest < 0.001)) {
        let res2_highest = calculateRedeployEffect(secondFallChar_highest, null, currentCostForHighest, fallCount_B_highest++, IS_TEAM_SCENARIO);
        currentHpForHighest += res2_highest.hpGained; currentCostForHighest = res2_highest.remainingCostAfterConsumption;
        highestSequence.push({ turn: currentTurn_highest++, charName: secondFallChar_highest.name, charType: getCharacterType(secondFallChar_highest, selectedPlayerChar), charCost: secondFallChar_highest.cost, hpGained: res2_highest.hpGained, costConsumed: res2_highest.costConsumed, remainingCost: currentCostForHighest.toFixed(1), note: res2_highest.note });

        if (currentCostForHighest >= 0.001 && !(res2_highest.note.includes("出撃不可") && res2_highest.hpGained <= 0 && res2_highest.costConsumed <= 0 && currentCostForHighest < 0.001)) {
            const subA_h = simulateRemainingSequenceAlternating(firstFallChar_highest, secondFallChar_highest, currentCostForHighest, fallCount_A_highest, fallCount_B_highest, IS_TEAM_SCENARIO, selectedPlayerChar);
            const subB_h = simulateRemainingSequenceContinuous(firstFallChar_highest, currentCostForHighest, fallCount_A_highest, IS_TEAM_SCENARIO, selectedPlayerChar);
            const subC_h = simulateRemainingSequenceContinuous(secondFallChar_highest, currentCostForHighest, fallCount_B_highest, IS_TEAM_SCENARIO, selectedPlayerChar);
            let bestSub_h = subA_h; if (subB_h.totalHp > bestSub_h.totalHp) bestSub_h = subB_h; if (subC_h.totalHp > bestSub_h.totalHp) bestSub_h = subC_h;
            currentHpForHighest += bestSub_h.totalHp; let subTurnCounter = currentTurn_highest; bestSub_h.sequence.forEach(item => { highestSequence.push({ ...item, turn: subTurnCounter++ }); });
        }
    }
    const idealScenario = { name: `チーム合計体力(理想) (${firstFallChar_highest.name}先落ち→${secondFallChar_highest.name}後落ち後最適化)`, totalHp: currentHpForHighest, sequence: highestSequence };

    // Compromise HP Scenario
    let firstFallChar_compromise, secondFallChar_compromise;
    if (selectedPlayerChar.cost < selectedPartnerChar.cost) { firstFallChar_compromise = selectedPlayerChar; secondFallChar_compromise = selectedPartnerChar; }
    else if (selectedPartnerChar.cost < selectedPlayerChar.cost) { firstFallChar_compromise = selectedPartnerChar; secondFallChar_compromise = selectedPlayerChar; }
    else { if (selectedPlayerChar.hp <= selectedPartnerChar.hp) { firstFallChar_compromise = selectedPlayerChar; secondFallChar_compromise = selectedPartnerChar; } else { firstFallChar_compromise = selectedPartnerChar; secondFallChar_compromise = selectedPlayerChar;} }

    let currentHpForCompromise = selectedPlayerChar.hp + selectedPartnerChar.hp;
    let currentCostForCompromise = MAX_TEAM_COST;
    let compromiseSequence = [];
    let fallCount_A_compromise = 0; let fallCount_B_compromise = 0; let currentTurn_compromise = 0;
    compromiseSequence.push({ turn: currentTurn_compromise++, charName: "初期HP", charType: "", charCost: 0, hpGained: currentHpForCompromise, costConsumed: 0, remainingCost: currentCostForCompromise.toFixed(1), note: `${selectedPlayerChar.name} (${selectedPlayerChar.hp.toLocaleString()}) + ${selectedPartnerChar.name} (${selectedPartnerChar.hp.toLocaleString()})` });

    let res1_compromise = calculateRedeployEffect(firstFallChar_compromise, null, currentCostForCompromise, fallCount_A_compromise++, IS_TEAM_SCENARIO);
    currentHpForCompromise += res1_compromise.hpGained; currentCostForCompromise = res1_compromise.remainingCostAfterConsumption;
    compromiseSequence.push({ turn: currentTurn_compromise++, charName: firstFallChar_compromise.name, charType: getCharacterType(firstFallChar_compromise, selectedPlayerChar), charCost: firstFallChar_compromise.cost, hpGained: res1_compromise.hpGained, costConsumed: res1_compromise.costConsumed, remainingCost: currentCostForCompromise.toFixed(1), note: res1_compromise.note });

    if(currentCostForCompromise >= 0.001 && !(res1_compromise.note.includes("出撃不可") && res1_compromise.hpGained <= 0 && res1_compromise.costConsumed <= 0 && currentCostForCompromise < 0.001)) {
        let res2_compromise = calculateRedeployEffect(secondFallChar_compromise, null, currentCostForCompromise, fallCount_B_compromise++, IS_TEAM_SCENARIO);
        currentHpForCompromise += res2_compromise.hpGained; currentCostForCompromise = res2_compromise.remainingCostAfterConsumption;
        compromiseSequence.push({ turn: currentTurn_compromise++, charName: secondFallChar_compromise.name, charType: getCharacterType(secondFallChar_compromise, selectedPlayerChar), charCost: secondFallChar_compromise.cost, hpGained: res2_compromise.hpGained, costConsumed: res2_compromise.costConsumed, remainingCost: currentCostForCompromise.toFixed(1), note: res2_compromise.note });

        if (currentCostForCompromise >= 0.001 && !(res2_compromise.note.includes("出撃不可") && res2_compromise.hpGained <= 0 && res2_compromise.costConsumed <= 0 && currentCostForCompromise < 0.001)) {
            const subA_c = simulateRemainingSequenceAlternating(firstFallChar_compromise, secondFallChar_compromise, currentCostForCompromise, fallCount_A_compromise, fallCount_B_compromise, IS_TEAM_SCENARIO, selectedPlayerChar);
            const subB_c = simulateRemainingSequenceContinuous(firstFallChar_compromise, currentCostForCompromise, fallCount_A_compromise, IS_TEAM_SCENARIO, selectedPlayerChar);
            const subC_c = simulateRemainingSequenceContinuous(secondFallChar_compromise, currentCostForCompromise, fallCount_B_compromise, IS_TEAM_SCENARIO, selectedPlayerChar);
            let bestSub_c = subA_c; if (subB_c.totalHp > bestSub_c.totalHp) bestSub_c = subB_c; if (subC_c.totalHp > bestSub_c.totalHp) bestSub_c = subC_c;
            currentHpForCompromise += bestSub_c.totalHp; let subTurnCounter_c = currentTurn_compromise; bestSub_c.sequence.forEach(item => { compromiseSequence.push({ ...item, turn: subTurnCounter_c++ }); });
        }
    }
    const compromiseScenario = { name: `チーム合計体力(妥協) (${firstFallChar_compromise.name}先落ち→${secondFallChar_compromise.name}後落ち後最適化)`, totalHp: currentHpForCompromise, sequence: compromiseSequence };

    // Bomb Scenario
    let fallingChar_bomb;
    if (selectedPlayerChar.cost < selectedPartnerChar.cost) { fallingChar_bomb = selectedPlayerChar; }
    else if (selectedPartnerChar.cost < selectedPlayerChar.cost) { fallingChar_bomb = selectedPartnerChar; }
    else { fallingChar_bomb = (selectedPlayerChar.hp <= selectedPartnerChar.hp) ? selectedPlayerChar : selectedPartnerChar; }
    const bombFallResult = simulateMinimumSequence(fallingChar_bomb, IS_TEAM_SCENARIO, selectedPlayerChar);
    const bombTotalHp = selectedPlayerChar.hp + selectedPartnerChar.hp + bombFallResult.totalHp;
    let bombSequence = [ { turn: 0, charName: "初期HP", charType: "", charCost: 0, hpGained: selectedPlayerChar.hp + selectedPartnerChar.hp, costConsumed: 0, remainingCost: MAX_TEAM_COST.toFixed(1), note: `${selectedPlayerChar.name} (${selectedPlayerChar.hp.toLocaleString()}) + ${selectedPartnerChar.name} (${selectedPartnerChar.hp.toLocaleString()})` } ];
    bombFallResult.sequence.forEach(item => { bombSequence.push(item); });
    const bombScenario = { name: `チーム合計体力(爆弾) (${fallingChar_bomb.name}のみ連続撃墜)`, totalHp: bombTotalHp, sequence: bombSequence };

    // Lowest HP Scenario (one character takes all hits)
    const playerFocusRedeploys = simulateMinimumSequence(selectedPlayerChar, IS_TEAM_SCENARIO, selectedPlayerChar);
    const lowestPlayerFocusTotalHp = selectedPlayerChar.hp + playerFocusRedeploys.totalHp;
    let lowestPlayerFocusSequence = [ { turn: 0, charName: "初期HP", charType: "", charCost: 0, hpGained: selectedPlayerChar.hp, costConsumed: 0, remainingCost: MAX_TEAM_COST.toFixed(1), note: `${selectedPlayerChar.name}(${selectedPlayerChar.hp.toLocaleString()})で開始、${selectedPlayerChar.name}が集中狙い` } ];
    playerFocusRedeploys.sequence.forEach(item => lowestPlayerFocusSequence.push(item));

    const partnerFocusRedeploys = simulateMinimumSequence(selectedPartnerChar, IS_TEAM_SCENARIO, selectedPlayerChar);
    const lowestPartnerFocusTotalHp = selectedPartnerChar.hp + partnerFocusRedeploys.totalHp;
    let lowestPartnerFocusSequence = [ { turn: 0, charName: "初期HP", charType: "", charCost: 0, hpGained: selectedPartnerChar.hp, costConsumed: 0, remainingCost: MAX_TEAM_COST.toFixed(1), note: `${selectedPartnerChar.name}(${selectedPartnerChar.hp.toLocaleString()})で開始、${selectedPartnerChar.name}が集中狙い` } ];
    partnerFocusRedeploys.sequence.forEach(item => lowestPartnerFocusSequence.push(item));

    let lowestScenario;
    if (lowestPlayerFocusTotalHp <= lowestPartnerFocusTotalHp) {
        lowestScenario = { name: `チーム合計体力(最低/${selectedPlayerChar.name}集中狙い)`, totalHp: lowestPlayerFocusTotalHp, sequence: lowestPlayerFocusSequence };
    } else {
        lowestScenario = { name: `チーム合計体力(最低/${selectedPartnerChar.name}集中狙い)`, totalHp: lowestPartnerFocusTotalHp, sequence: lowestPartnerFocusSequence };
    }
    return { idealScenario, compromiseScenario, bombScenario, lowestScenario };
}

export function calculateTeamHpScenarios() {
    const selectedPlayerChar = getSelectedPlayerChar();
    const selectedPartnerChar = getSelectedPartnerChar();
    return calculateTeamHpScenariosInternal(selectedPlayerChar, selectedPartnerChar);
}

export function calculateTeamHpScenariosForCharacters(playerChar, partnerChar) {
    return calculateTeamHpScenariosInternal(playerChar, partnerChar);
}


export function calculateAwakeningGauge(inputs) {
    const {
        gaugeBeforeShotdown, // Should be number 0-100
        damageTakenInputValue, // Should be number >= 0
        originalCharActualMaxHp, // Should be number > 0
        charCost, // Should be number
        charName, // Should be string
        considerOwnDown, // boolean
        considerDamageDealt, // boolean
        damageDealtBonus, // string representing a number
        considerShieldSuccess, // boolean
        shieldSuccessBonus, // string representing a number
        considerPartnerDown // boolean
    } = inputs;

    // Input validation
    if (typeof originalCharActualMaxHp !== 'number' || originalCharActualMaxHp <= 0 ||
        typeof charCost !== 'number' ||
        typeof gaugeBeforeShotdown !== 'number' || gaugeBeforeShotdown < 0 || gaugeBeforeShotdown > 100 ||
        typeof damageTakenInputValue !== 'number' || damageTakenInputValue < 0) {
        // console.error("Invalid input for calculateAwakeningGauge:", inputs);
        return { finalPredictedGauge: 0, isThresholdMet: false, error: true, validatedDamageTaken: damageTakenInputValue };
    }

    let actualDamageTaken = Math.max(0, Math.min(damageTakenInputValue, originalCharActualMaxHp));

    const hpLossPercentage = (originalCharActualMaxHp > 0) ? (actualDamageTaken / originalCharActualMaxHp) * 100 : 0;
    const damageBasedGaugeIncrease = Math.floor(hpLossPercentage * AVERAGE_GAUGE_COEFFICIENT);

    let costBonusOnOwnDown = 0;
    if (considerOwnDown) {
        costBonusOnOwnDown = AWAKENING_BONUS_BY_COST[charCost.toFixed(1)] || 0;
        if (charName === "スコーピオン") { // Specific character override
            costBonusOnOwnDown = 15;
        }
    }

    let additionalGaugeFromDamageDealt = 0;
    if (considerDamageDealt) {
        const bonus = parseInt(damageDealtBonus, 10);
        if (!isNaN(bonus) && bonus >=0) { // Assuming bonus values are positive
            additionalGaugeFromDamageDealt = bonus;
        }
    }

    let additionalGaugeFromShieldSuccess = 0;
    if (considerShieldSuccess) {
        const bonus = parseInt(shieldSuccessBonus, 10);
        if (!isNaN(bonus) && bonus >= 0) {
            additionalGaugeFromShieldSuccess = bonus;
        }
    }

    let additionalGaugeFromPartnerDown = 0;
    if (considerPartnerDown) {
        additionalGaugeFromPartnerDown = PARTNER_DOWN_AWAKENING_BONUS[charCost.toFixed(1)] || 0;
    }

    let finalPredictedGauge = gaugeBeforeShotdown + damageBasedGaugeIncrease + costBonusOnOwnDown + additionalGaugeFromDamageDealt + additionalGaugeFromShieldSuccess + additionalGaugeFromPartnerDown;
    finalPredictedGauge = Math.max(0, Math.min(100, Math.floor(finalPredictedGauge)));

    const breakdown = {
        baseGauge: gaugeBeforeShotdown,
        damageIncrease: damageBasedGaugeIncrease,
        validatedDamageTaken: actualDamageTaken,
        originalMaxHp: originalCharActualMaxHp,
        ownDown: {
            enabled: considerOwnDown,
            value: costBonusOnOwnDown
        },
        damageBonus: {
            enabled: considerDamageDealt,
            value: additionalGaugeFromDamageDealt
        },
        shieldBonus: {
            enabled: considerShieldSuccess,
            value: additionalGaugeFromShieldSuccess
        },
        partnerBonus: {
            enabled: considerPartnerDown,
            value: additionalGaugeFromPartnerDown
        },
        total: finalPredictedGauge
    };

    return {
        finalPredictedGauge,
        isThresholdMet: finalPredictedGauge >= AWAKENING_THRESHOLD,
        error: false,
        validatedDamageTaken: actualDamageTaken,
        breakdown
    };
}

export function calculateSingleRedeployHp(charToRedeploy, allocatedCostForThisRedeploy) {
    // Validate inputs
    if (!charToRedeploy || typeof charToRedeploy.cost !== 'number' || typeof charToRedeploy.hp !== 'number' ||
        typeof allocatedCostForThisRedeploy !== 'number' || allocatedCostForThisRedeploy < 0) {
        // console.error("Invalid arguments for calculateSingleRedeployHp", {charToRedeploy, allocatedCostForThisRedeploy});
        return { calculatedHp: 0, actualCostConsumed: 0 };
    }

    let calculatedHp;
    let actualCostConsumed = 0;
    const originalCharHp = charToRedeploy.hp;
    const charFullCost = charToRedeploy.cost;

    if (allocatedCostForThisRedeploy < 0.001) {
        calculatedHp = 0;
        actualCostConsumed = 0;
    } else {
        let effectiveCostForHpCalc = Math.min(allocatedCostForThisRedeploy, charFullCost);

        if (charFullCost <= 0) {
            calculatedHp = 0;
        } else {
            calculatedHp = Math.round(originalCharHp * (effectiveCostForHpCalc / charFullCost));
        }

        if (allocatedCostForThisRedeploy >= charFullCost) {
            actualCostConsumed = charFullCost;
        } else {
            actualCostConsumed = allocatedCostForThisRedeploy;
        }
    }
    return { calculatedHp, actualCostConsumed };
}