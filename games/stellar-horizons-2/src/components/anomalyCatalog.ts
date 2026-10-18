import { TechField } from './techFields.js'
import { TradeGood } from './tradeGoods.js'

export enum AnomalyChallenge {
    Science = 'Science',
    Combat = 'Combat'
}

export enum CardDeck {
    Fleet = 'Fleet',
    Genetic = 'Genetic'
}

// The reward printed on an anomaly's front (rulebook 1.16), earned by whoever resolves it.
export interface AnomalyReward {
    influence?: number
    cash?: number
    markers?: { field: TechField; count: number }
    settlements?: number
    goods?: { good: TradeGood; count: number }
    card?: CardDeck
}

export enum AnomalyBackKind {
    Remove = 'Remove',
    StellarChart = 'StellarChart',
    Bases = 'Bases'
}

// The permanent effect on the reverse side for bases in the system, once resolved.
export interface BaseEffects {
    cashProduction?: number
    markerProduction?: { fields: readonly TechField[]; count: number }
    goodsProduction?: readonly TradeGood[]
    settlementLossInProduction?: number
    settlementsDoubledForProduction?: true
    settlementAfterProduction?: number
    migrationHabitability?: number
    migrationSettlement?: number
    shipCostReduction?: number
    populationLimit?: number
    opponentNonFleetCombat?: number
}

export type AnomalyBack =
    | { kind: AnomalyBackKind.Remove }
    | { kind: AnomalyBackKind.StellarChart }
    | { kind: AnomalyBackKind.Bases; effects: BaseEffects }

export interface AnomalyDefinition {
    id: string
    name: string
    challenge: AnomalyChallenge
    difficulty: number
    noExploration: boolean
    noBases: boolean
    reward: AnomalyReward
    back: AnomalyBack
}

const S = AnomalyChallenge.Science
const C = AnomalyChallenge.Combat

const B = TechField.Biology
const P = TechField.Physics
const E = TechField.Engineering
const REMOVE: AnomalyBack = { kind: AnomalyBackKind.Remove }

function bases(effects: BaseEffects): AnomalyBack {
    return { kind: AnomalyBackKind.Bases, effects }
}

function markers(field: TechField, count: number) {
    return { field, count }
}

function produce(fields: readonly TechField[]) {
    return { fields, count: 1 }
}

// Transcribed from the anomaly markers in the Vassal module (fronts and backs).
export const ANOMALIES: readonly AnomalyDefinition[] = [
    anomaly(
        'adorable-critters',
        'Adorable Critters',
        S,
        2,
        false,
        false,
        { markers: markers(B, 1) },
        bases({ goodsProduction: [TradeGood.Entertainment] })
    ),
    anomaly(
        'alien-artifacts',
        'Alien Artifacts',
        S,
        7,
        false,
        false,
        { markers: markers(E, 3) },
        bases({ markerProduction: produce([E]), goodsProduction: [TradeGood.FineArt] })
    ),
    anomaly(
        'alien-derelict',
        'Alien Derelict',
        S,
        9,
        false,
        true,
        { card: CardDeck.Fleet },
        bases({ markerProduction: produce([P, E]) })
    ),
    anomaly(
        'alien-remains',
        'Alien Remains',
        S,
        9,
        false,
        true,
        { card: CardDeck.Genetic },
        bases({ markerProduction: produce([B]) })
    ),
    anomaly(
        'alien-sentinel',
        'Alien Sentinel',
        C,
        15,
        true,
        true,
        { influence: 8 },
        bases({ markerProduction: produce([P, E]) })
    ),
    anomaly('anarchist-outpost', 'Anarchist Outpost', C, 7, true, true, { influence: 5 }, REMOVE),
    anomaly(
        'asteroid-clouds',
        'Asteroid Clouds',
        C,
        5,
        true,
        true,
        { influence: 1, cash: 5 },
        bases({ cashProduction: 2 })
    ),
    anomaly(
        'colossal-comet',
        'Colossal Comet',
        C,
        3,
        false,
        false,
        { influence: 1, cash: 3 },
        bases({ markerProduction: produce([P]) })
    ),
    anomaly(
        'decapod-infestation',
        'Decapod Infestation',
        C,
        6,
        false,
        true,
        { influence: 4 },
        bases({ markerProduction: produce([B]) })
    ),
    anomaly(
        'dissidents',
        'Dissidents',
        C,
        7,
        false,
        false,
        { settlements: 3 },
        bases({ migrationHabitability: 30 })
    ),
    anomaly(
        'hostile-xenomorphs',
        'Hostile Xenomorphs',
        C,
        9,
        false,
        true,
        { influence: 6, goods: { good: TradeGood.Fauna, count: 1 } },
        bases({ goodsProduction: [TradeGood.Fauna], settlementLossInProduction: 1 })
    ),
    anomaly(
        'ice-caverns',
        'Ice Caverns',
        S,
        3,
        false,
        false,
        { influence: 2 },
        bases({ cashProduction: 1 })
    ),
    anomaly(
        'medicinal-herbs',
        'Medicinal Herbs',
        S,
        4,
        false,
        false,
        { markers: markers(B, 2) },
        bases({ goodsProduction: [TradeGood.Medicine] })
    ),
    anomaly(
        'megafauna',
        'Megafauna',
        C,
        5,
        false,
        true,
        { influence: 2, goods: { good: TradeGood.Fauna, count: 2 } },
        bases({ goodsProduction: [TradeGood.Fauna] })
    ),
    anomaly(
        'mineral-veins',
        'Mineral Veins',
        S,
        5,
        false,
        false,
        { cash: 4 },
        bases({ cashProduction: 3 })
    ),
    anomaly(
        'nanobot-swarm',
        'Nanobot Swarm',
        C,
        8,
        true,
        true,
        { influence: 5, goods: { good: TradeGood.Machinery, count: 1 } },
        bases({ goodsProduction: [TradeGood.Machinery], shipCostReduction: 1 })
    ),
    anomaly(
        'natural-stimulants',
        'Natural Stimulants',
        S,
        5,
        false,
        false,
        { markers: markers(B, 2) },
        bases({ settlementsDoubledForProduction: true })
    ),
    anomaly(
        'pirate-lair',
        'Pirate Lair',
        C,
        6,
        true,
        true,
        { influence: 2, cash: 4 },
        bases({ cashProduction: 1 })
    ),
    anomaly(
        'predatory-plants',
        'Predatory Plants',
        C,
        1,
        false,
        true,
        { influence: 1, goods: { good: TradeGood.Flora, count: 1 } },
        bases({ markerProduction: produce([B]), goodsProduction: [TradeGood.Flora] })
    ),
    anomaly(
        'primal-carnivores',
        'Primal Carnivores',
        C,
        3,
        false,
        true,
        { influence: 2, goods: { good: TradeGood.Fauna, count: 1 } },
        bases({ markerProduction: produce([B]) })
    ),
    anomaly(
        'rare-crystals',
        'Rare Crystals',
        S,
        6,
        false,
        false,
        { cash: 5 },
        bases({ markerProduction: produce([P]) })
    ),
    anomaly('rescue-scout-ship', 'Rescue Scout Ship', S, 1, true, true, { influence: 3 }, REMOVE),
    anomaly(
        'savage-storms',
        'Savage Storms',
        S,
        7,
        false,
        true,
        { influence: 3, markers: markers(P, 1) },
        bases({ markerProduction: produce([P]) })
    ),
    anomaly(
        'severe-radiation',
        'Severe Radiation',
        S,
        5,
        true,
        true,
        { influence: 1, markers: markers(P, 2) },
        bases({ cashProduction: 1, goodsProduction: [TradeGood.RareMaterials] })
    ),
    anomaly(
        'shadow-fleet',
        'Shadow Fleet',
        C,
        12,
        true,
        true,
        { influence: 7 },
        bases({ markerProduction: produce([P, E]) })
    ),
    anomaly('splinter-colony', 'Splinter Colony', C, 1, true, true, { settlements: 2 }, REMOVE),
    anomaly(
        'stellar-chart',
        'Stellar Chart',
        S,
        4,
        false,
        false,
        { influence: 3 },
        { kind: AnomalyBackKind.StellarChart }
    ),
    anomaly(
        'stellar-flares',
        'Stellar Flares',
        S,
        3,
        true,
        true,
        { markers: markers(P, 2) },
        bases({ markerProduction: produce([P]) })
    ),
    anomaly(
        'stunning-vistas',
        'Stunning Vistas',
        S,
        3,
        false,
        false,
        { influence: 2 },
        bases({ migrationSettlement: 1 })
    ),
    anomaly(
        'symbiotic-spores',
        'Symbiotic Spores',
        S,
        7,
        false,
        true,
        { markers: markers(B, 3) },
        bases({ settlementAfterProduction: 1 })
    ),
    anomaly(
        'system-quarantine',
        'System Quarantine',
        S,
        9,
        true,
        true,
        { influence: 2, markers: markers(B, 2) },
        bases({ markerProduction: produce([B]) })
    ),
    anomaly(
        'terran-dna',
        'Terran DNA',
        S,
        8,
        false,
        true,
        { influence: 2, markers: markers(B, 2) },
        bases({ markerProduction: produce([B]) })
    ),
    anomaly(
        'tunnel-complex',
        'Tunnel Complex',
        S,
        4,
        false,
        false,
        { markers: markers(E, 2) },
        bases({ opponentNonFleetCombat: -1, populationLimit: 5 })
    ),
    anomaly(
        'violent-separatists',
        'Violent Separatists',
        C,
        8,
        true,
        true,
        { influence: 6 },
        REMOVE
    )
]

function anomaly(
    id: string,
    name: string,
    challenge: AnomalyChallenge,
    difficulty: number,
    noExploration: boolean,
    noBases: boolean,
    reward: AnomalyReward,
    back: AnomalyBack
): AnomalyDefinition {
    return { id, name, challenge, difficulty, noExploration, noBases, reward, back }
}
