import { TechField } from './techFields.js'
import { TradeGood } from './tradeGoods.js'
import { WorldClass } from './worldTypes.js'

export enum CardDeck {
    Fleet = 'Fleet',
    Genetic = 'Genetic'
}

export const CARD_DECKS: readonly CardDeck[] = [CardDeck.Fleet, CardDeck.Genetic]
export const CARD_LEVELS = [1, 2, 3] as const
export type CardLevel = (typeof CARD_LEVELS)[number]

// What a card does, as data the capability lookup folds in (model/capabilities.ts). Numbers
// add to what techs and faction abilities give: a card bonus stacks with a tech bonus
// (rulebook 1.12) and with other cards.
export interface CardEffects {
    // Ship, settlement and cloning prices, in $B.
    cvCost?: number
    reCost?: number
    fastShipCost?: number
    settlementCost?: number
    firstSettlementCost?: number
    cloningCost?: number
    // Tech and card prices, in tech points.
    techCost?: number
    fieldTechCost?: { field: TechField; amount: number }
    cardCost?: number
    deckCardCost?: { deck: CardDeck; amount: number }
    // Ships.
    allShipsFast?: true
    cvMalfunction?: number
    reMalfunction?: number
    cvExplorationBonus?: number
    reExplorationBonus?: number
    cvExplorationDice?: number
    reExplorationDice?: number
    cvAnomalyChance?: number
    reAnomalyChance?: number
    cvCargo?: number
    cvDamage?: number
    maxShips?: number
    extraRe?: number
    selfRepair?: number
    // Exploration, mining and research.
    surveyDraws?: number
    miningCash?: number
    miningDice?: number
    researchFullValue?: true
    researchShipBonus?: number
    scienceDifficulty?: number
    combatDifficulty?: number
    armedCvCombat?: number
    // Combat value when defending in a system where the owner has a base.
    defendingCombat?: number
    // Escalation markers drawn beyond those owed, one of the drawn then discarded.
    extraEscalation?: number
    // Economy.
    cashProduction?: number
    extraGoods?: number
    producesAnywhere?: { goods: readonly TradeGood[]; exceptSol?: true }
    saleBonus?: { goods: readonly TradeGood[]; amount: number }
    demandChoices?: number
    keepsTwoDemand?: true
    influencePerTurn?: number
    initiative?: number
    // Settlements.
    populationByClass?: Partial<Record<WorldClass, number>>
    population?: number
    dwarfStarPopulation?: number
    habitability?: number
    growth?: number
    dwarfStarGrowth?: number
    growthByClass?: Partial<Record<WorldClass, number>>
    chosenGrowth?: number
    migration?: number
    growthPastLimit?: true
    noMigration?: true
    conversionRoll?: number
    // Terraforming, movement and the turn.
    terraforms?: number
    sideTwoTerraformDraws?: number
    wormholes?: true
    choosesEconomicTile?: true
    endRollModifier?: number
    handSize?: number
}

export interface CardDefinition {
    id: string
    name: string
    deck: CardDeck
    level: CardLevel
    copies: number
    // The circle's colour: grey engineering, blue physics, green biology.
    field: TechField
    cost: number
    // The star.
    points: number
    text: string
    effects: CardEffects
    // The part of the card that needs a rule not in the game yet (combat, slice 5), as players
    // read it.
    waits?: string
    excludes?: string
}

const { Fleet, Genetic } = CardDeck
const { Biology: B, Physics: P, Engineering: E } = TechField
const { M, O, L, H, A, P: PClass, D, J, E: EClass } = WorldClass

function card(
    id: string,
    name: string,
    deck: CardDeck,
    level: CardLevel,
    field: TechField,
    cost: number,
    points: number,
    text: string,
    effects: CardEffects,
    extra: { copies?: number; waits?: string; excludes?: string } = {}
): CardDefinition {
    return {
        id,
        name,
        deck,
        level,
        copies: extra.copies ?? 1,
        field,
        cost,
        points,
        text,
        effects,
        ...(extra.waits ? { waits: extra.waits } : {}),
        ...(extra.excludes ? { excludes: extra.excludes } : {})
    }
}

// Transcribed from the Vassal module's card fronts (notes/vassal-inventory.md 3.14 and appendix
// B): 28 fleet improvements in 35 cards and 35 genetic manipulations.
export const CARDS: readonly CardDefinition[] = [
    card('crew-focus', 'Crew Focus', Fleet, 1, E, 12, 1, 'CV cost -$2B', { cvCost: -2 }),
    card(
        'hypersonic-missiles',
        'Hypersonic Missiles',
        Fleet,
        1,
        P,
        7,
        2,
        '+1 combat value to armed CVs (includes anomaly/event resolution); -1 to enemy planetary assault and raid rolls when defending',
        { armedCvCombat: 1 },
        {
            waits: 'Its combat value in combat and its defence against assaults and raids are not in the game yet; its +1 already counts against blockades and in the Syndicate’s take.'
        }
    ),
    card(
        'minefields',
        'Minefields',
        Fleet,
        1,
        P,
        5,
        3,
        '+3 combat value when defending in a system where you have a base',
        { defendingCombat: 3 },
        { waits: 'Its defence in combat is not in the game yet; it counts against blockades.' }
    ),
    card(
        'planetary-surveys',
        'Planetary Surveys',
        Fleet,
        1,
        P,
        9,
        3,
        'When drawing worlds for completed surveys, draw two and choose which to use',
        { surveyDraws: 2 }
    ),
    card(
        'reinforced-hulls',
        'Reinforced Hulls',
        Fleet,
        1,
        E,
        12,
        2,
        'CVs can take one extra damage',
        {
            cvDamage: 1
        }
    ),
    card(
        'resilient-crews',
        'Resilient Crews',
        Fleet,
        1,
        E,
        8,
        1,
        'CV malfunction rate -5%',
        { cvMalfunction: -5 },
        { copies: 2 }
    ),
    card('robotic-focus', 'Robotic Focus', Fleet, 1, E, 7, 1, 'RE cost -$1B', { reCost: -1 }),
    card(
        'robo-miners',
        'Robo Miners',
        Fleet,
        1,
        E,
        8,
        3,
        'Bases produce +$1B when producing cash',
        {
            cashProduction: 1
        }
    ),
    card(
        'scout-ships',
        'Scout Ships',
        Fleet,
        1,
        P,
        12,
        2,
        'CV exploration bonus +1; +5% chance of finding anomalies with CVs',
        { cvExplorationBonus: 1, cvAnomalyChance: 5 }
    ),
    card(
        'sensor-upgrades',
        'Sensor Upgrades',
        Fleet,
        1,
        P,
        12,
        1,
        'RE exploration bonus +1',
        { reExplorationBonus: 1 },
        { copies: 3 }
    ),
    card(
        'superior-robotics',
        'Superior Robotics',
        Fleet,
        1,
        E,
        8,
        1,
        'RE malfunction rate -3%',
        { reMalfunction: -3 },
        { copies: 2 }
    ),
    card(
        'deep-core-mining',
        'Deep Core Mining',
        Fleet,
        2,
        E,
        15,
        3,
        'Bases produce +$2B when producing cash',
        { cashProduction: 2 }
    ),
    card(
        'engine-upgrades',
        'Engine Upgrades',
        Fleet,
        2,
        P,
        20,
        3,
        'Treat all your non-fast ships as fast; ships marked as fast cost -$2B',
        { allShipsFast: true, fastShipCost: -2 }
    ),
    card(
        'explorers-guild',
        "Explorer's Guild",
        Fleet,
        2,
        P,
        20,
        5,
        'Roll 2 dice for CV exploration and choose which to use; +5% chance of finding anomalies with CVs',
        { cvExplorationDice: 2, cvAnomalyChance: 5 }
    ),
    card(
        'freight-haulers',
        'Freight Haulers',
        Fleet,
        2,
        E,
        30,
        1,
        'Crew vehicle cargo capacity +1 for ships that carry cargo',
        { cvCargo: 1 }
    ),
    card(
        'mining-vessel-upgrades',
        'Mining Vessel Upgrades',
        Fleet,
        2,
        E,
        12,
        2,
        'Mining ships produce $1B extra',
        { miningCash: 1 }
    ),
    card(
        'quantum-sensors',
        'Quantum Sensors',
        Fleet,
        2,
        P,
        15,
        3,
        'Roll 2 dice for exploration actions taken by REs and choose which to use; +5% chance of finding anomalies with REs',
        { reExplorationDice: 2, reAnomalyChance: 5 }
    ),
    card(
        'research-vessel-upgrades',
        'Research Vessel Upgrades',
        Fleet,
        2,
        P,
        15,
        4,
        'Research ships use their full exploration value for research and count as +2 exploration value for anomaly/event resolution',
        { researchFullValue: true, researchShipBonus: 2 }
    ),
    card(
        'robotic-swarms',
        'Robotic Swarms',
        Fleet,
        2,
        P,
        25,
        1,
        'Max number of ships +1 (extra must be RE)',
        { extraRe: 1 },
        { copies: 2 }
    ),
    card(
        'self-repair-system',
        'Self Repair System',
        Fleet,
        2,
        E,
        20,
        3,
        'Remove 1 damage from each of your CVs for free during the build & repair phase',
        { selfRepair: 1 }
    ),
    card(
        'starports',
        'Starports',
        Fleet,
        2,
        P,
        15,
        5,
        'Systems where you have a base get both demand markers instead of drawing 2 and picking 1',
        { keepsTwoDemand: true }
    ),
    card(
        'traders-guild',
        "Trader's Guild",
        Fleet,
        2,
        E,
        15,
        4,
        'Draw an extra trade good during the Economic Phase draw; when drawing demand markers, draw an extra to choose from',
        { extraGoods: 1, demandChoices: 1 }
    ),
    card(
        'fleet-logistics',
        'Fleet Logistics',
        Fleet,
        3,
        P,
        30,
        1,
        'Max number of ships +1',
        { maxShips: 1 },
        { copies: 2 }
    ),
    card(
        'interstellar-mining-conglomerate',
        'Interstellar Mining Conglomerate',
        Fleet,
        3,
        E,
        20,
        8,
        'Roll 2 dice for mining and choose which to use; bases produce +$2B when producing cash',
        { miningDice: 2, cashProduction: 2 }
    ),
    card(
        'military-academy',
        'Military Academy',
        Fleet,
        3,
        E,
        25,
        7,
        '+1 to combat rolls; fleet improvements cost -3; draw +1 escalation marker each time you normally would and choose one of those drawn to discard',
        { deckCardCost: { deck: Fleet, amount: -3 }, extraEscalation: 1 },
        { waits: 'Its combat rolls are not in the game yet.' }
    ),
    card(
        'planetary-engineering',
        'Planetary Engineering',
        Fleet,
        3,
        E,
        20,
        5,
        'One extra terraforming action; if terraforming from a world\'s "II" side, draw an extra world to choose from',
        { terraforms: 1, sideTwoTerraformDraws: 1 }
    ),
    card(
        'science-academy',
        'Science Academy',
        Fleet,
        3,
        P,
        30,
        9,
        'Exploration bonus +1; genetic manipulations cost 5 less; reduce difficulty of science anomalies & events by 3',
        {
            cvExplorationBonus: 1,
            reExplorationBonus: 1,
            deckCardCost: { deck: Genetic, amount: -5 },
            scienceDifficulty: -3
        }
    ),
    card(
        'stabilized-wormholes',
        'Stabilized Wormholes',
        Fleet,
        3,
        P,
        50,
        9,
        'Treat systems where you have bases as adjacent for movement purposes',
        { wormholes: true },
        { copies: 2 }
    ),
    card(
        'aquatic-tolerance',
        'Aquatic Tolerance',
        Genetic,
        1,
        B,
        8,
        3,
        'Treat M worlds as +5 and O worlds as +10 max population',
        { populationByClass: { [M]: 5, [O]: 10 } }
    ),
    card(
        'arid-tolerance',
        'Arid Tolerance',
        Genetic,
        1,
        B,
        7,
        2,
        'Treat A, H, and L worlds as +5 max population',
        { populationByClass: { [A]: 5, [H]: 5, [L]: 5 } }
    ),
    card(
        'cold-tolerance',
        'Cold Tolerance',
        Genetic,
        1,
        B,
        7,
        2,
        'Treat P, D, and L worlds as +5 max population',
        { populationByClass: { [PClass]: 5, [D]: 5, [L]: 5 } }
    ),
    card(
        'creative',
        'Creative',
        Genetic,
        1,
        B,
        10,
        3,
        'Genetic manipulation and fleet improvement hand size +1 (of each). Immediately draw up to your new hand size for each',
        { handSize: 1 }
    ),
    card(
        'culinary-geniuses',
        'Culinary Geniuses',
        Genetic,
        1,
        B,
        9,
        2,
        'Draw an extra trade good; you can produce food & beverages in any system; sell food & beverages for +$1B',
        {
            extraGoods: 1,
            producesAnywhere: { goods: [TradeGood.Food, TradeGood.Beverages] },
            saleBonus: { goods: [TradeGood.Food, TradeGood.Beverages], amount: 1 }
        }
    ),
    card(
        'cunning',
        'Cunning',
        Genetic,
        1,
        B,
        9,
        3,
        '+20% to initiative roll; reduce difficulty of anomalies and events by 1',
        { initiative: 20, scienceDifficulty: -1, combatDifficulty: -1 }
    ),
    card(
        'enhanced-strength',
        'Enhanced Strength',
        Genetic,
        1,
        B,
        7,
        2,
        '+1 to ground combat and planetary assault rolls (attack & defense)',
        {},
        { waits: 'Combat is not in the game yet.' }
    ),
    card(
        'environmental-tolerance',
        'Environmental Tolerance',
        Genetic,
        1,
        B,
        9,
        1,
        'Treat system habitability as +20% for base building and migration (max 100%)',
        { habitability: 20 }
    ),
    card(
        'gifted-artists',
        'Gifted Artists',
        Genetic,
        1,
        B,
        7,
        5,
        'Draw an extra trade good; you can produce fine art in any system except Sol; sell fine art for +$1B',
        {
            extraGoods: 1,
            producesAnywhere: { goods: [TradeGood.FineArt], exceptSol: true },
            saleBonus: { goods: [TradeGood.FineArt], amount: 1 }
        }
    ),
    card(
        'pioneers',
        'Pioneers',
        Genetic,
        1,
        B,
        10,
        1,
        '-$1B to the cost of buying your first settlement on Earth each turn',
        { firstSettlementCost: -1 }
    ),
    card(
        'prolific-breeders',
        'Prolific Breeders',
        Genetic,
        1,
        B,
        12,
        2,
        'Settlement growth +1 at one of your bases (your choice which each growth phase)',
        { chosenGrowth: 1 }
    ),
    card(
        'radiation-tolerance',
        'Radiation Tolerance',
        Genetic,
        1,
        B,
        9,
        4,
        'Treat J and D worlds as +5 max population',
        { populationByClass: { [J]: 5, [D]: 5 } }
    ),
    card(
        'skilled-biologists',
        'Skilled Biologists',
        Genetic,
        1,
        B,
        9,
        1,
        'Biology techs cost 3 less',
        { fieldTechCost: { field: B, amount: -3 } }
    ),
    card(
        'skilled-engineers',
        'Skilled Engineers',
        Genetic,
        1,
        B,
        9,
        1,
        'Engineering techs cost 3 less',
        { fieldTechCost: { field: E, amount: -3 } }
    ),
    card(
        'skilled-entertainers',
        'Skilled Entertainers',
        Genetic,
        1,
        B,
        8,
        3,
        'Draw an extra trade good; you can produce entertainment in any system; sell entertainment for +$1B',
        {
            extraGoods: 1,
            producesAnywhere: { goods: [TradeGood.Entertainment] },
            saleBonus: { goods: [TradeGood.Entertainment], amount: 1 }
        }
    ),
    card(
        'skilled-naturalists',
        'Skilled Naturalists',
        Genetic,
        1,
        B,
        8,
        3,
        'Draw an extra trade good; you can produce flora & fauna in any system; sell flora & fauna for +$1B',
        {
            extraGoods: 1,
            producesAnywhere: { goods: [TradeGood.Flora, TradeGood.Fauna] },
            saleBonus: { goods: [TradeGood.Flora, TradeGood.Fauna], amount: 1 }
        }
    ),
    card(
        'skilled-physicists',
        'Skilled Physicists',
        Genetic,
        1,
        B,
        9,
        1,
        'Physics techs cost 3 less',
        { fieldTechCost: { field: P, amount: -3 } }
    ),
    card(
        'cultural-dominance',
        'Cultural Dominance',
        Genetic,
        2,
        B,
        15,
        5,
        "After settlement growth, you can roll a die - on 3 or less, you can convert 1 of another player's settlements into your own (in a single system, not last one in base)",
        { conversionRoll: 3 }
    ),
    card(
        'eager-migrants',
        'Eager Migrants',
        Genetic,
        2,
        B,
        20,
        2,
        'Migration increases population by 2 instead of 1',
        { migration: 2 }
    ),
    card(
        'increased-body-size',
        'Increased Body Size',
        Genetic,
        2,
        B,
        15,
        5,
        "+1 IP at the start of each turn; treat all systems as -5 max pop.; +1 to ground combat and planetary assault rolls (attack & defense) (can't have reduced size)",
        { influencePerTurn: 1, population: -5 },
        {
            waits: 'Its ground combat and planetary assault rolls are not in the game yet.',
            excludes: 'reduced-body-size'
        }
    ),
    card(
        'infrared-vision',
        'Infrared Vision',
        Genetic,
        2,
        B,
        12,
        5,
        'In systems with red or brown dwarf stars, gain +5 max population and settlement growth +1',
        { dwarfStarPopulation: 5, dwarfStarGrowth: 1 }
    ),
    card(
        'enhanced-intellect',
        'Enhanced Intellect',
        Genetic,
        2,
        B,
        20,
        3,
        'Techs cost 2 less; reduce difficulty of science anomalies and events by 2',
        { techCost: -2, scienceDifficulty: -2 }
    ),
    // Printed "Neural Interfce".
    card(
        'neural-interface',
        'Neural Interface',
        Genetic,
        2,
        B,
        20,
        2,
        'Techs and fleet improvements cost 2 less',
        { techCost: -2, deckCardCost: { deck: Fleet, amount: -2 } }
    ),
    card(
        'reduced-body-size',
        'Reduced Body Size',
        Genetic,
        2,
        B,
        10,
        3,
        "Treat all systems as +10 max pop.; -1 to ground combat & planetary assault rolls (attack & defense) (can't have increased size)",
        { population: 10 },
        {
            waits: 'Its ground combat and planetary assault rolls are not in the game yet.',
            excludes: 'increased-body-size'
        }
    ),
    card(
        'skilled-artisans',
        'Skilled Artisans',
        Genetic,
        2,
        B,
        15,
        6,
        'Draw 2 extra trade goods during the Economic Phase draw',
        { extraGoods: 2 }
    ),
    card(
        'spacefaring-populace',
        'Spacefaring Populace',
        Genetic,
        2,
        B,
        40,
        1,
        'Settlements cost $1B less on Earth',
        { settlementCost: -1 }
    ),
    card(
        'zero-g-tolerance',
        'Zero-G Tolerance',
        Genetic,
        2,
        B,
        15,
        5,
        'Treat J & D worlds as +10 max population',
        { populationByClass: { [J]: 10, [D]: 10 } }
    ),
    card(
        'aquatic-species',
        'Aquatic Species',
        Genetic,
        3,
        B,
        30,
        8,
        'Settlement growth +2 on each O world where you have a base; treat O worlds as +15 and M worlds as +5 max population',
        { growthByClass: { [O]: 2 }, populationByClass: { [O]: 15, [M]: 5 } }
    ),
    card(
        'cyborg-species',
        'Cyborg Species',
        Genetic,
        3,
        B,
        30,
        3,
        'Reduce the cost of cloning to $3B per settlement',
        { cloningCost: 3 }
    ),
    card(
        'desert-species',
        'Desert Species',
        Genetic,
        3,
        B,
        30,
        7,
        'Settlement growth +1 on each L world or +2 on each H world where you have a base; treat H worlds as +15 and L worlds as +5 max population',
        { growthByClass: { [L]: 1, [H]: 2 }, populationByClass: { [H]: 15, [L]: 5 } }
    ),
    card(
        'flying',
        'Flying',
        Genetic,
        3,
        B,
        35,
        9,
        'Settlement growth +1 on each J or E world where you have a base; treat J and E worlds as +30 max population',
        { growthByClass: { [J]: 1, [EClass]: 1 }, populationByClass: { [J]: 30, [EClass]: 30 } }
    ),
    card(
        'hive-mind',
        'Hive Mind',
        Genetic,
        3,
        B,
        40,
        9,
        "You can choose which economic phase tile to draw of those available (can't draw same twice in a row); techs and cards cost 2 less",
        { choosesEconomicTile: true, techCost: -2, cardCost: -2 }
    ),
    card(
        'natural-immortality',
        'Natural Immortality',
        Genetic,
        3,
        B,
        40,
        9,
        'Settlement growth +2 at all your bases',
        { growth: 2 }
    ),
    card(
        'subterranean',
        'Subterranean',
        Genetic,
        3,
        B,
        30,
        5,
        "Treat all systems as +10 max pop.; -2 to opponent's ground combat & planetary assault rolls when defending",
        { population: 10 },
        { waits: 'Its ground combat and planetary assault rolls are not in the game yet.' }
    ),
    card(
        'transcend-biology',
        'Transcend Biology',
        Genetic,
        3,
        B,
        50,
        15,
        'Ignore population limits for growth but cease all migration; you can modify the end of game die roll by +/- 3% (announce before rolling)',
        { growthPastLimit: true, noMigration: true, endRollModifier: 3 }
    )
]

export function cardDefinition(cardId: string): CardDefinition {
    const definition = CARDS.find((candidate) => candidate.id === cardId)
    if (!definition) {
        throw new Error(`Unknown card ${cardId}`)
    }
    return definition
}

// The cards of one deck and level, a copy per printed card.
export function deckCards(deck: CardDeck, level: CardLevel): string[] {
    return CARDS.filter(
        (definition) => definition.deck === deck && definition.level === level
    ).flatMap((definition) => Array.from({ length: definition.copies }, () => definition.id))
}

export function romanLevel(level: CardLevel): string {
    return ['I', 'II', 'III'][level - 1]
}

const DECK_NAMES: Record<CardDeck, { name: string; short: string }> = {
    [CardDeck.Fleet]: { name: 'fleet improvement', short: 'Fleet' },
    [CardDeck.Genetic]: { name: 'genetic manipulation', short: 'Genetic' }
}

// "fleet improvement", as text names a card of the deck.
export function deckName(deck: CardDeck): string {
    return DECK_NAMES[deck].name
}

// "Fleet", as a card back prints it.
export function deckShortName(deck: CardDeck): string {
    return DECK_NAMES[deck].short
}
