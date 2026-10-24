import { AnomalyChallenge } from './anomalyCatalog.js'
import { CardDeck } from './cards.js'

// Rulebook 5.2 and the module's 14 title cards (`notes/vassal-inventory.md` 3.9 and appendix
// C.3). Every title is worth 10 VP.
export enum TitleId {
    Admiral = 'admiral',
    Warlord = 'warlord',
    Chancellor = 'chancellor',
    Cartographer = 'cartographer',
    Engineer = 'engineer',
    Geneticist = 'geneticist',
    Governor = 'governor',
    Guardian = 'guardian',
    Guildmaster = 'guildmaster',
    Mastermind = 'mastermind',
    Navigator = 'navigator',
    PlanetaryArchitect = 'planetary-architect',
    Prospector = 'prospector',
    Researcher = 'researcher'
}

export enum OperationRoll {
    Mining = 'Mining',
    Research = 'Research'
}

export enum TitlePrerequisiteKind {
    None = 'None',
    TerraformedIntoM = 'TerraformedIntoM',
    AttackedByMoreEscalation = 'AttackedByMoreEscalation',
    ResolvedChallenge = 'ResolvedChallenge',
    SoldOnEarth = 'SoldOnEarth',
    NarrowMalfunction = 'NarrowMalfunction',
    RolledOne = 'RolledOne',
    ExplorationMarkers = 'ExplorationMarkers',
    Cards = 'Cards',
    BaseSettlements = 'BaseSettlements',
    EscalationMarkers = 'EscalationMarkers'
}

const P = TitlePrerequisiteKind

// What a Player must have done this turn, or have now, to buy a title (rulebook 5.2).
export type TitlePrerequisite =
    | { kind: typeof P.None }
    // This turn.
    | { kind: typeof P.TerraformedIntoM }
    | { kind: typeof P.AttackedByMoreEscalation }
    | { kind: typeof P.ResolvedChallenge; challenge: AnomalyChallenge; difficulty: number }
    | { kind: typeof P.SoldOnEarth; count: number }
    | { kind: typeof P.NarrowMalfunction; within: number }
    | { kind: typeof P.RolledOne; operation: OperationRoll }
    // Now.
    | { kind: typeof P.ExplorationMarkers; count: number }
    | { kind: typeof P.Cards; deck: CardDeck; count: number }
    | { kind: typeof P.BaseSettlements; count: number }
    | { kind: typeof P.EscalationMarkers; count: number }

// Rulebook 5.2: "the prerequisite must be met this turn"; one not bought is lost with the turn.
const THIS_TURN_PREREQUISITES: readonly TitlePrerequisiteKind[] = [
    P.TerraformedIntoM,
    P.AttackedByMoreEscalation,
    P.ResolvedChallenge,
    P.SoldOnEarth,
    P.NarrowMalfunction,
    P.RolledOne
]

export function expiresWithTheTurn(prerequisite: TitlePrerequisite): boolean {
    return THIS_TURN_PREREQUISITES.includes(prerequisite.kind)
}

// What owning a title does, read through `capabilitiesOf` as cards are.
export interface TitleEffects {
    combatRoll?: number
    cannotRaid?: true
    attacksOnlyMoreEscalation?: true
    excludesOtherTitles?: true
    influencePerTurn?: number
    anomalyChance?: number
    handSize?: { deck: CardDeck; amount: number }
    cardCost?: { deck: CardDeck; amount: number }
    migrationHabitability?: number
    difficulty?: { challenge: AnomalyChallenge; amount: number }
    earthSaleInfluence?: number
    malfunction?: number
    extraTerraforms?: number
    miningWorldValue?: number
    researchWorldValue?: number
}

export interface TitleDefinition {
    id: TitleId
    name: string
    cost: number
    // Admiral, Warlord and Chancellor are always laid out and never replaced when bought.
    fixed: boolean
    text: string
    prerequisiteText: string
    prerequisite: TitlePrerequisite
    effects: TitleEffects
}

export const TITLE_POINTS = 10
// Each title costs 5 more for every title its buyer already owns.
export const TITLE_SURCHARGE = 5
export const DRAWN_TITLES = 3
// Fewer titles than this laid out besides the fixed three, a renounced one is laid out again.
export const MIN_OTHER_TITLES = 3

const { Combat, Science } = AnomalyChallenge

export const TITLES: readonly TitleDefinition[] = [
    {
        id: TitleId.Admiral,
        name: 'Admiral',
        cost: 7,
        fixed: true,
        text: '+2 to combat rolls; can’t raid; can only attack players who have more escalation',
        prerequisiteText: 'Be attacked by a player who has more escalation',
        prerequisite: { kind: P.AttackedByMoreEscalation },
        effects: { combatRoll: 2, cannotRaid: true, attacksOnlyMoreEscalation: true }
    },
    {
        id: TitleId.Warlord,
        name: 'Warlord',
        cost: 8,
        fixed: true,
        text: '+1 to combat rolls (cannot have any other titles)',
        prerequisiteText: 'Have 6 escalation markers',
        prerequisite: { kind: P.EscalationMarkers, count: 6 },
        effects: { combatRoll: 1, excludesOtherTitles: true }
    },
    {
        id: TitleId.Chancellor,
        name: 'Chancellor',
        cost: 15,
        fixed: true,
        text: 'Draw one influence at the start of each turn',
        prerequisiteText: 'None',
        prerequisite: { kind: P.None },
        effects: { influencePerTurn: 1 }
    },
    {
        id: TitleId.Cartographer,
        name: 'Cartographer',
        cost: 7,
        fixed: false,
        text: '+5% chance of finding anomalies',
        prerequisiteText: 'Own 3 exploration markers from last completed survey',
        prerequisite: { kind: P.ExplorationMarkers, count: 3 },
        effects: { anomalyChance: 5 }
    },
    {
        id: TitleId.Engineer,
        name: 'Engineer',
        cost: 7,
        fixed: false,
        text: 'Fleet improvement card hand size +1 and cost -2',
        prerequisiteText: 'Own 3 fleet improvement cards',
        prerequisite: { kind: P.Cards, deck: CardDeck.Fleet, count: 3 },
        effects: {
            handSize: { deck: CardDeck.Fleet, amount: 1 },
            cardCost: { deck: CardDeck.Fleet, amount: -2 }
        }
    },
    {
        id: TitleId.Geneticist,
        name: 'Geneticist',
        cost: 7,
        fixed: false,
        text: 'Genetic manipulation card hand size +1 and cost -2',
        prerequisiteText: 'Own 3 genetic manipulation cards',
        prerequisite: { kind: P.Cards, deck: CardDeck.Genetic, count: 3 },
        effects: {
            handSize: { deck: CardDeck.Genetic, amount: 1 },
            cardCost: { deck: CardDeck.Genetic, amount: -2 }
        }
    },
    {
        id: TitleId.Governor,
        name: 'Governor',
        cost: 10,
        fixed: false,
        text: '+10% habitability for migration at all your bases',
        prerequisiteText: 'Have a base with at least 15 settlements',
        prerequisite: { kind: P.BaseSettlements, count: 15 },
        effects: { migrationHabitability: 10 }
    },
    {
        id: TitleId.Guardian,
        name: 'Guardian',
        cost: 7,
        fixed: false,
        text: 'Treat combat anomaly & event difficulty as -2',
        prerequisiteText: 'Resolve combat anomaly or event with 10+ difficulty',
        prerequisite: { kind: P.ResolvedChallenge, challenge: Combat, difficulty: 10 },
        effects: { difficulty: { challenge: Combat, amount: -2 } }
    },
    {
        id: TitleId.Guildmaster,
        name: 'Guildmaster',
        cost: 9,
        fixed: false,
        text: 'Earn 1 influence for each trade good you sell on Earth',
        prerequisiteText: 'Sell 3 trade goods on Earth',
        prerequisite: { kind: P.SoldOnEarth, count: 3 },
        effects: { earthSaleInfluence: 1 }
    },
    {
        id: TitleId.Mastermind,
        name: 'Mastermind',
        cost: 7,
        fixed: false,
        text: 'Treat science anomaly & event difficulty as -2',
        prerequisiteText: 'Resolve science anomaly or event with 10+ difficulty',
        prerequisite: { kind: P.ResolvedChallenge, challenge: Science, difficulty: 10 },
        effects: { difficulty: { challenge: Science, amount: -2 } }
    },
    {
        id: TitleId.Navigator,
        name: 'Navigator',
        cost: 10,
        fixed: false,
        text: '-3% malfunction rate (REs and CVs)',
        prerequisiteText: 'Avoid malfunction by 3% or less',
        prerequisite: { kind: P.NarrowMalfunction, within: 3 },
        effects: { malfunction: -3 }
    },
    {
        id: TitleId.PlanetaryArchitect,
        name: 'Planetary Architect',
        cost: 10,
        fixed: false,
        text: 'One extra terraforming action per terraforming phase',
        prerequisiteText: 'Terraform a world into M-class',
        prerequisite: { kind: P.TerraformedIntoM },
        effects: { extraTerraforms: 1 }
    },
    {
        id: TitleId.Prospector,
        name: 'Prospector',
        cost: 7,
        fixed: false,
        text: 'Treat world values as 1 higher for mining',
        prerequisiteText: 'Roll a “1” while mining',
        prerequisite: { kind: P.RolledOne, operation: OperationRoll.Mining },
        effects: { miningWorldValue: 1 }
    },
    {
        id: TitleId.Researcher,
        name: 'Researcher',
        cost: 8,
        fixed: false,
        text: 'Treat world values as 1 higher for research',
        prerequisiteText: 'Roll a “1” while researching',
        prerequisite: { kind: P.RolledOne, operation: OperationRoll.Research },
        effects: { researchWorldValue: 1 }
    }
]

export function titleDefinition(titleId: TitleId): TitleDefinition {
    const title = TITLES.find((candidate) => candidate.id === titleId)
    if (!title) {
        throw new Error(`Unknown title ${titleId}`)
    }
    return title
}
