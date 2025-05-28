// Character Grid and Filters
export const characterGrid = document.getElementById('characterGrid');
export const characterSearchInput = document.getElementById('characterSearch');
export const searchIcon = document.querySelector('.search-icon');
export const costFilterButtons = document.querySelectorAll('#costFilter .filter-button');
export const sortFilterButtons = document.querySelectorAll('#sortFilter .filter-button');

// Accordions
export const mainAccordionHeaders = document.querySelectorAll('.accordion-header:not(.sub-accordion-header)');
export const subAccordionHeaders = document.querySelectorAll('.sub-accordion-header');
export const totalHpAccordionHeaders = document.querySelectorAll('.total-hp-accordion-header');

// Loading Overlay
export const loadingOverlay = document.getElementById('loadingOverlay');

// Redeploy Simulation Section
export const playerCharSelect = document.getElementById('playerCharSelect');
export const partnerCharSelect = document.getElementById('partnerCharSelect');
export const totalTeamCostSpan = document.getElementById('totalTeamCost');
export const selectedCharsDisplay = document.getElementById('selectedCharsDisplay');
export const remainingTeamCostInput = document.getElementById('remainingTeamCostInput');
export const simulatePlayerRedeployBtn = document.getElementById('simulatePlayerRedeploy');
export const simulatePartnerRedeployBtn = document.getElementById('simulatePartnerRedeploy');

// Redeploy Simulation Results
export const simulationResultsDiv = document.getElementById('simulationResults');
export const redeployCharNameSpan = document.getElementById('redeployCharName');
export const redeployCharCostSpan = document.getElementById('redeployCharCost');
export const redeployOriginalHpSpan = document.getElementById('redeployOriginalHp');
export const redeployCostConsumedSpan = document.getElementById('redeployCostConsumed');
export const redeployCalculatedHpSpan = document.getElementById('redeployCalculatedHp');
export const simulationHpBarFill = simulationResultsDiv?.querySelector('.hp-bar-fill');
export const simulationHpPercentageDisplay = simulationResultsDiv?.querySelector('.hp-percentage-display');

// Awakening Gauge Prediction
export const awakeningSimulationArea = document.querySelector('.awakening-simulation-area');
export const beforeShotdownAwakeningGaugeInput = document.getElementById('beforeShotdownAwakeningGaugeInput');
export const beforeShotdownHpInput_damageTakenInput = document.getElementById('beforeShotdownHpInput');
export const considerOwnDownCheckbox = document.getElementById('considerOwnDownCheckbox');
export const considerDamageDealtCheckbox = document.getElementById('considerDamageDealtCheckbox');
export const damageDealtOptionsContainer = document.getElementById('damageDealtOptionsContainer');
export const damageDealtAwakeningBonusSelect = document.getElementById('damageDealtAwakeningBonusSelect');
export const considerPartnerDownCheckbox = document.getElementById('considerPartnerDownCheckbox');
export const predictedAwakeningGaugeSpan = document.getElementById('predictedAwakeningGauge');
export const awakeningAvailabilitySpan = document.getElementById('awakeningAvailability');

// Awakening Gauge Calculation Details (for dynamic value insertion)
export const avgGaugeCoeffValueSpan = document.getElementById('avgGaugeCoeffValue');
export const avgGaugeCoeffExampleValueSpan = document.getElementById('avgGaugeCoeffExampleValue');
export const ownDownBonus30Span = document.getElementById('ownDownBonus30');
export const ownDownBonus20Span = document.getElementById('ownDownBonus20');
export const ownDownBonus15Span = document.getElementById('ownDownBonus15');
export const partnerDownBonus30Span = document.getElementById('partnerDownBonus30');
export const partnerDownBonus25Span = document.getElementById('partnerDownBonus25');
export const partnerDownBonus20Span = document.getElementById('partnerDownBonus20');
export const partnerDownBonus15Span = document.getElementById('partnerDownBonus15');
export const awakeningThresholdValueSpan = document.getElementById('awakeningThresholdValue');


// Total Team HP Display Area
export const totalHpDisplayArea = document.getElementById('totalHpDisplayArea');
export const selectedPlayerCharNameSummary = document.getElementById('selectedPlayerCharNameSummary');
export const selectedPartnerCharNameSummary = document.getElementById('selectedPartnerCharNameSummary');

export const highestHpScenarioTitleSpan = document.getElementById('highestHpScenarioTitle');
export const idealGainedHpSpan = document.getElementById('idealGainedHp');
export const idealSequenceList = document.getElementById('idealSequenceList');

export const compromiseHpScenarioTitleSpan = document.getElementById('compromiseHpScenarioTitle');
export const minGainedHpHpSpan = document.getElementById('minGainedHpHpSpan');
export const minSequenceList = document.getElementById('minSequenceList');

export const bombHpScenarioTitleSpan = document.getElementById('bombHpScenarioTitle');
export const bombGainedHpSpan = document.getElementById('bombGainedHp');
export const bombSequenceList = document.getElementById('bombSequenceList');

export const lowestHpScenarioTitleSpan = document.getElementById('lowestHpScenarioTitle');
export const lowestGainedHpSpan = document.getElementById('lowestGainedHp');
export const lowestSequenceList = document.getElementById('lowestSequenceList');