import { AnomalyChallenge } from '../components/anomalyCatalog.js'
import { CardDeck, cardDefinition, type CardEffects } from '../components/cards.js'
import { escalationDefinition, type EscalationEffects } from '../components/escalation.js'
import { factionSheet, type FactionAbilities } from '../components/factionSheets.js'
import { techDefinition, type TechEffects } from '../components/techs.js'
import { titleDefinition, type TitleEffects } from '../components/titles.js'
import { TechField } from '../components/techFields.js'
import type { TradeGood } from '../components/tradeGoods.js'
import { WorldClass } from '../components/worldTypes.js'
import type { ScenarioDefinition } from '../components/scenarios.js'
import type { RollModifier } from './pieces.js'
import type { HydratedStellarHorizonsPlayerState } from './playerState.js'

// Everything a Player's techs, faction sheet, cards and escalation markers let them do, in one
// place: rules read this instead of asking which tech, faction, card or marker a Player has.
// Techs in a chain keep their best value; faction abilities and card bonuses add to it (rulebook
// 1.12), and escalation markers are cumulative (Player Guide 2.5).
export interface Capabilities {
    canBuySettlements: boolean
    settleHabitability?: number
    habitabilityBonus: number
    terraforms: number
    terraformDraws: number
    cvMalfunction: number
    reMalfunction: number
    cvExplorationBonus: number
    reExplorationBonus: number
    cvExplorationDice: number
    reExplorationDice: number
    cvMovement: number
    reMovement: number
    allShipsFast: boolean
    cvRange: number
    reRange: number
    cvMaxSize: number
    cvCostChange: number
    reCostChange: number
    fastShipCostChange: number
    cvDamageBonus: number
    maxShipsBonus: number
    extraRe: number
    selfRepair: number
    settlementCost: number
    // Escalation's on-Earth surcharge, already in settlementCost.
    settlementSurcharge: number
    firstSettlementDiscount: number
    cloning: boolean
    cloningCost?: number
    shipTerraforming: boolean
    cargoBonus: number
    cvCargoBonus: number
    // Tech points off a tech of each field, and off a card of each deck.
    techDiscount: Record<TechField, number>
    cardDiscount: Record<CardDeck, number>
    cardLevels: Record<CardDeck, number>
    handSize: Record<CardDeck, number>
    cardSurcharge: Record<CardDeck, number>
    anomalyChance?: number
    cvAnomalyChance: number
    reAnomalyChance: number
    difficulty: Record<AnomalyChallenge, number>
    armedCvCombat: number
    defendingCombat: number
    // Each faction's, card's or title's modifier to combat and raid rolls, kept apart to be named.
    rollModifiers: SourcedRollModifier[]
    // Admiral's restrictions (rulebook 5.2).
    cannotRaid: boolean
    attacksOnlyMoreEscalation: boolean
    // Cartographer's +5% to find anomalies, Guildmaster's IP for each good sold on Earth, and
    // Prospector's and Researcher's +1 to world values.
    titleAnomalyChance: number
    earthSaleInfluence: number
    miningWorldValue: number
    researchWorldValue: number
    raidImmune: boolean
    lowersRaidResult: boolean
    extraEscalation: number
    attacksForbidden: boolean
    earthCash: number
    earthMarkers: Record<TechField, number>
    saleChange: number
    migrationChange: number
    researchFullValue: boolean
    researchShipBonus: number
    surveyDraws: number
    miningCash: number
    miningDice: number
    cashProduction: number
    extraGoods: number
    producesAnywhere: { good: TradeGood; exceptSol: boolean }[]
    saleBonus: Partial<Record<TradeGood, number>>
    demandDraws: number
    keepsTwoDemand: boolean
    influencePerTurn: number
    initiativeBonus: number
    populationByClass: Partial<Record<WorldClass, number>>
    population: number
    dwarfStarPopulation: number
    growth: number
    dwarfStarGrowth: number
    growthByClass: Partial<Record<WorldClass, number>>
    chosenGrowth: number
    migrationSettlements: number
    growthPastLimit: boolean
    conversionRolls: number[]
    wormholes: boolean
    choosesEconomicTile: boolean
    endRollModifier: number
}

// Rulebook 1.5 and the cards: modifiers to a Player's own rolls (every combat, or ground
// combats), and to the rolls of those who attack them (ground combats, or assaults and raids).
export type RollEffect =
    'combatRoll' | 'groundRoll' | 'opponentGroundRoll' | 'opponentAssaultRaidRoll'
const ROLL_EFFECTS: readonly RollEffect[] = [
    'combatRoll',
    'groundRoll',
    'opponentGroundRoll',
    'opponentAssaultRaidRoll'
]

export interface SourcedRollModifier extends RollModifier {
    effect: RollEffect
}

export const CV_MOVEMENT_STEPS: readonly number[] = [5, 4, 3, 2, 1.5, 1, 0.5]
export const MIN_MOVEMENT_MODIFIER = 0.5
// Rulebook 1.20.
export const CARD_SURCHARGE = 5
export const FAVOURED_CARD_SURCHARGE = 3
export const HAND_SIZE = 1
// Rulebook 1.9: draw 2 demand markers and keep 1.
export const DEMAND_DRAW = 2
// Campaign plan, slice 4 (Q15): no price below $1B.
export const MIN_PRICE = 1

const BASELINE = {
    cvMalfunction: 50,
    reMalfunction: 30,
    cvMovement: 5,
    reMovement: 3,
    cvRange: 1,
    reRange: 1,
    cvMaxSize: 2,
    cardLevel: 1,
    researchShipBonus: 1
}

type NumericCardEffect = {
    [Key in keyof CardEffects]-?: CardEffects[Key] extends number | undefined ? Key : never
}[keyof CardEffects]

type NumericTitleEffect = {
    [Key in keyof TitleEffects]-?: TitleEffects[Key] extends number | undefined ? Key : never
}[keyof TitleEffects]

type NumericEscalationEffect = {
    [Key in keyof EscalationEffects]-?: EscalationEffects[Key] extends number | undefined
        ? Key
        : never
}[keyof EscalationEffects]

export function playerCapabilities(
    player: HydratedStellarHorizonsPlayerState,
    scenario: ScenarioDefinition,
    year: number
): Capabilities {
    const techValues = new Map<string, number[]>()
    const techFlags = new Set<string>()
    for (const owned of player.techs) {
        for (const [key, value] of Object.entries(techDefinition(owned.techId).effects)) {
            techFlags.add(key)
            if (typeof value === 'number') {
                techValues.set(key, [...(techValues.get(key) ?? []), value])
            }
        }
    }
    const values = (key: keyof TechEffects): number[] => techValues.get(key) ?? []
    const has = (key: keyof TechEffects): boolean => techFlags.has(key)
    const lowest = (key: keyof TechEffects, baseline: number) => Math.min(baseline, ...values(key))
    const highest = (key: keyof TechEffects, baseline: number) => Math.max(baseline, ...values(key))
    const habitability = values('settleHabitability')

    const titles: TitleEffects[] = player.titles.map((titleId) => titleDefinition(titleId).effects)
    const titleSum = (key: NumericTitleEffect) =>
        titles.reduce((total, effect) => total + (effect[key] ?? 0), 0)
    const titleDeckAmount = (key: 'handSize' | 'cardCost', deck: CardDeck) =>
        titles.reduce(
            (total, effect) =>
                total + (effect[key]?.deck === deck ? (effect[key]?.amount ?? 0) : 0),
            0
        )
    const titleDifficulty = (challenge: AnomalyChallenge) =>
        titles.reduce(
            (total, effect) =>
                total + (effect.difficulty?.challenge === challenge ? effect.difficulty.amount : 0),
            0
        )
    const abilities: FactionAbilities =
        scenario.campaign && player.faction ? factionSheet(player.faction).abilities : {}
    const effects = player.cards.map((card) => cardDefinition(card.cardId).effects)
    const escalation = player.escalation.map((marker) => escalationDefinition(marker).effects)
    const escalationSum = (key: NumericEscalationEffect) =>
        escalation.reduce((total, effect) => total + (effect[key] ?? 0), 0)
    // Discounts from a card bought this turn wait for the next (campaign plan, slice 4, Q2).
    const discounts = player.cards
        .filter((card) => !card.bought || card.year < year)
        .map((card) => cardDefinition(card.cardId).effects)
    const sum = (key: NumericCardEffect, from = effects) =>
        from.reduce((total, effect) => total + (effect[key] ?? 0), 0)
    const any = (test: (effect: CardEffects) => boolean) => effects.some(test)
    const byClass = (key: 'populationByClass' | 'growthByClass') => {
        const totals: Partial<Record<WorldClass, number>> = {}
        for (const worldClass of Object.values(WorldClass)) {
            const total = effects.reduce(
                (subtotal, effect) => subtotal + (effect[key]?.[worldClass] ?? 0),
                0
            )
            if (total !== 0) {
                totals[worldClass] = total
            }
        }
        return totals
    }
    // Discounts are negative cost changes; their total is the points taken off.
    const discount = (
        general: 'techCost' | 'cardCost',
        specific: (effect: CardEffects) => number
    ) => -sum(general, discounts) - discounts.reduce((total, effect) => total + specific(effect), 0)

    const techTerraforms = scenario.terraforming ? highest('terraforms', 0) : 0
    const conversionRolls = [
        ...(abilities.conversionRoll === undefined ? [] : [abilities.conversionRoll]),
        ...effects.flatMap((effect) =>
            effect.conversionRoll === undefined ? [] : [effect.conversionRoll]
        )
    ]
    const saleBonus: Partial<Record<TradeGood, number>> = {}
    for (const effect of effects) {
        for (const good of effect.saleBonus?.goods ?? []) {
            saleBonus[good] = (saleBonus[good] ?? 0) + (effect.saleBonus?.amount ?? 0)
        }
    }

    return {
        canBuySettlements: has('buySettlements'),
        settleHabitability: habitability.length > 0 ? Math.min(...habitability) : undefined,
        habitabilityBonus: (abilities.habitabilityBonus ?? 0) + sum('habitability'),
        // The Givers' extra action needs no tech; Planetary Engineering's adds to the tech's.
        // Planetary Architect adds to an action the Player has, as Planetary Engineering does
        // (campaign plan, slice 6, Q11).
        terraforms:
            techTerraforms +
            (techTerraforms > 0 ? sum('terraforms') : 0) +
            (abilities.extraTerraforms ?? 0) +
            (techTerraforms > 0 || abilities.extraTerraforms ? titleSum('extraTerraforms') : 0),
        terraformDraws: highest('terraformDraws', 1) + sum('sideTwoTerraformDraws'),
        cvMalfunction: Math.max(
            0,
            lowest('cvMalfunction', BASELINE.cvMalfunction) +
                sum('cvMalfunction') +
                titleSum('malfunction')
        ),
        reMalfunction: Math.max(
            0,
            lowest('reMalfunction', BASELINE.reMalfunction) +
                sum('reMalfunction') +
                titleSum('malfunction')
        ),
        cvExplorationBonus: highest('cvExplorationBonus', 0) + sum('cvExplorationBonus'),
        reExplorationBonus: highest('reExplorationBonus', 0) + sum('reExplorationBonus'),
        cvExplorationDice: Math.max(1, ...effects.map((effect) => effect.cvExplorationDice ?? 1)),
        reExplorationDice: Math.max(1, ...effects.map((effect) => effect.reExplorationDice ?? 1)),
        cvMovement: lowest('cvMovement', BASELINE.cvMovement),
        reMovement: lowest('reMovement', BASELINE.reMovement),
        allShipsFast: any((effect) => effect.allShipsFast === true),
        cvRange: highest('cvRange', BASELINE.cvRange),
        reRange: highest('reRange', BASELINE.reRange),
        cvMaxSize: highest('cvMaxSize', BASELINE.cvMaxSize),
        cvCostChange: sum('cvCost'),
        reCostChange: sum('reCost'),
        fastShipCostChange: sum('fastShipCost'),
        cvDamageBonus: sum('cvDamage'),
        maxShipsBonus: sum('maxShips'),
        extraRe: sum('extraRe'),
        selfRepair: sum('selfRepair'),
        // Escalation's surcharge comes on top of the cheapest price the discounts allow.
        settlementCost:
            Math.max(
                MIN_PRICE,
                settlementCost(player, scenario) -
                    highest('settlementDiscount', 0) +
                    sum('settlementCost')
            ) + escalationSum('earthSettlementCost'),
        settlementSurcharge: escalationSum('earthSettlementCost'),
        firstSettlementDiscount: -sum('firstSettlementCost'),
        cloning: has('cloning'),
        cloningCost: effects.find((effect) => effect.cloningCost !== undefined)?.cloningCost,
        shipTerraforming: has('mineTerraforming'),
        cargoBonus: highest('cargoBonus', 0),
        cvCargoBonus: sum('cvCargo'),
        techDiscount: perField((field) =>
            discount('techCost', (effect) =>
                effect.fieldTechCost?.field === field ? effect.fieldTechCost.amount : 0
            )
        ),
        cardDiscount: perDeck(
            (deck) =>
                discount('cardCost', (effect) =>
                    effect.deckCardCost?.deck === deck ? effect.deckCardCost.amount : 0
                ) - titleDeckAmount('cardCost', deck)
        ),
        cardLevels: {
            [CardDeck.Fleet]: highest('fleetLevel', BASELINE.cardLevel),
            [CardDeck.Genetic]: highest('geneticLevel', BASELINE.cardLevel)
        },
        handSize: perDeck(
            (deck) =>
                HAND_SIZE +
                (abilities.favouredDeck === deck ? 1 : 0) +
                sum('handSize') +
                titleDeckAmount('handSize', deck)
        ),
        cardSurcharge: perDeck((deck) =>
            abilities.favouredDeck === deck ? FAVOURED_CARD_SURCHARGE : CARD_SURCHARGE
        ),
        anomalyChance: abilities.anomalyChance,
        cvAnomalyChance: sum('cvAnomalyChance'),
        reAnomalyChance: sum('reAnomalyChance'),
        difficulty: {
            [AnomalyChallenge.Science]:
                (abilities.scienceAnomalyDifficulty ?? 0) +
                sum('scienceDifficulty') +
                titleDifficulty(AnomalyChallenge.Science),
            [AnomalyChallenge.Combat]:
                (abilities.combatAnomalyDifficulty ?? 0) +
                sum('combatDifficulty') +
                titleDifficulty(AnomalyChallenge.Combat)
        },
        armedCvCombat: sum('armedCvCombat'),
        defendingCombat: sum('defendingCombat'),
        // Praetorians and Military Academy each add 1, together 2 (campaign plan, slice 5, Q8).
        rollModifiers: [
            ...(abilities.combatRoll && player.faction
                ? [
                      {
                          effect: 'combatRoll' as const,
                          source: { kind: 'Faction' as const, faction: player.faction },
                          value: abilities.combatRoll
                      }
                  ]
                : []),
            ...player.cards.flatMap(({ cardId }) => {
                const cardEffects = cardDefinition(cardId).effects
                return ROLL_EFFECTS.flatMap((effect): SourcedRollModifier[] => {
                    const value = cardEffects[effect]
                    return value ? [{ effect, source: { kind: 'Card', cardId }, value }] : []
                })
            }),
            // Admiral's +2 and Warlord's +1 (rulebook 5.2).
            ...player.titles.flatMap((titleId): SourcedRollModifier[] => {
                const value = titleDefinition(titleId).effects.combatRoll
                return value
                    ? [{ effect: 'combatRoll', source: { kind: 'Title', titleId }, value }]
                    : []
            })
        ],
        cannotRaid: titles.some((title) => title.cannotRaid === true),
        attacksOnlyMoreEscalation: titles.some((title) => title.attacksOnlyMoreEscalation === true),
        titleAnomalyChance: titleSum('anomalyChance'),
        earthSaleInfluence: titleSum('earthSaleInfluence'),
        miningWorldValue: titleSum('miningWorldValue'),
        researchWorldValue: titleSum('researchWorldValue'),
        raidImmune: abilities.raidImmune === true,
        lowersRaidResult: abilities.lowersRaidResult === true,
        extraEscalation: sum('extraEscalation'),
        attacksForbidden: escalation.some((effect) => effect.forbidsAttacks === true),
        earthCash: escalationSum('earthCash'),
        earthMarkers: perField(
            (field) => escalation.filter((effect) => effect.earthMarker === field).length
        ),
        saleChange: escalationSum('saleChange'),
        migrationChange: escalationSum('migrationChange') + titleSum('migrationHabitability'),
        researchFullValue: any((effect) => effect.researchFullValue === true),
        researchShipBonus: Math.max(
            BASELINE.researchShipBonus,
            ...effects.map((effect) => effect.researchShipBonus ?? 0)
        ),
        surveyDraws: Math.max(1, ...effects.map((effect) => effect.surveyDraws ?? 1)),
        miningCash: sum('miningCash'),
        miningDice: Math.max(1, ...effects.map((effect) => effect.miningDice ?? 1)),
        cashProduction: sum('cashProduction'),
        extraGoods: sum('extraGoods'),
        producesAnywhere: effects.flatMap((effect) =>
            (effect.producesAnywhere?.goods ?? []).map((good) => ({
                good,
                exceptSol: effect.producesAnywhere?.exceptSol === true
            }))
        ),
        saleBonus,
        demandDraws: (abilities.demandDraws ?? DEMAND_DRAW) + sum('demandChoices'),
        keepsTwoDemand: any((effect) => effect.keepsTwoDemand === true),
        influencePerTurn: sum('influencePerTurn') + titleSum('influencePerTurn'),
        initiativeBonus: sum('initiative') + escalationSum('initiative'),
        populationByClass: byClass('populationByClass'),
        population: sum('population'),
        dwarfStarPopulation: sum('dwarfStarPopulation'),
        growth: sum('growth'),
        dwarfStarGrowth: sum('dwarfStarGrowth'),
        growthByClass: byClass('growthByClass'),
        chosenGrowth: sum('chosenGrowth'),
        migrationSettlements: any((effect) => effect.noMigration === true)
            ? 0
            : Math.max(1, ...effects.map((effect) => effect.migration ?? 1)),
        growthPastLimit: any((effect) => effect.growthPastLimit === true),
        conversionRolls,
        wormholes: any((effect) => effect.wormholes === true),
        choosesEconomicTile: any((effect) => effect.choosesEconomicTile === true),
        endRollModifier: Math.max(0, ...effects.map((effect) => effect.endRollModifier ?? 0))
    }
}

function perField(value: (field: TechField) => number): Record<TechField, number> {
    return {
        [TechField.Biology]: value(TechField.Biology),
        [TechField.Physics]: value(TechField.Physics),
        [TechField.Engineering]: value(TechField.Engineering)
    }
}

function perDeck(value: (deck: CardDeck) => number): Record<CardDeck, number> {
    return { [CardDeck.Fleet]: value(CardDeck.Fleet), [CardDeck.Genetic]: value(CardDeck.Genetic) }
}

// Scenarios price settlements at $5B for everyone; the campaign uses the faction sheet.
function settlementCost(
    player: HydratedStellarHorizonsPlayerState,
    scenario: ScenarioDefinition
): number {
    return scenario.campaign && player.faction
        ? factionSheet(player.faction).settlementCost
        : scenario.settlementCost
}

export function fastMovementModifier(cvMovement: number): number {
    const index = CV_MOVEMENT_STEPS.indexOf(cvMovement)
    const faster = CV_MOVEMENT_STEPS[index + 1]
    return faster ?? MIN_MOVEMENT_MODIFIER
}
