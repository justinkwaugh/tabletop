import { TechField } from './techFields.js'

export enum TechId {
    InterstellarSettlement = 'InterstellarSettlement',
    ImprovedInterstellarExpeditions = 'ImprovedInterstellarExpeditions',
    Terraforming = 'Terraforming',
    ImprovedInterstellarSettlement = 'ImprovedInterstellarSettlement',
    AdvancedInterstellarExpeditions = 'AdvancedInterstellarExpeditions',
    ImprovedGeneticManipulation = 'ImprovedGeneticManipulation',
    AdvancedInterstellarSettlement = 'AdvancedInterstellarSettlement',
    InterstellarLogistics = 'InterstellarLogistics',
    AdvancedTerraforming = 'AdvancedTerraforming',
    HarshSpaceEnvironment = 'HarshSpaceEnvironment',
    ImprovedInterstellarLogistics = 'ImprovedInterstellarLogistics',
    AdvancedGeneticManipulation = 'AdvancedGeneticManipulation',
    AdvancedInterstellarLogistics = 'AdvancedInterstellarLogistics',
    AtmosphereProcessing = 'AtmosphereProcessing',
    Cloning = 'Cloning',
    AdvancedLaserPropulsion = 'AdvancedLaserPropulsion',
    LongDistanceProbes = 'LongDistanceProbes',
    FusionRockets = 'FusionRockets',
    UltraLongDistanceProbes = 'UltraLongDistanceProbes',
    AdvancedFusionRockets = 'AdvancedFusionRockets',
    LongDistanceMissions = 'LongDistanceMissions',
    MiniaturizedFusionRockets = 'MiniaturizedFusionRockets',
    BussardRamjets = 'BussardRamjets',
    AntimatterRockets = 'AntimatterRockets',
    UltraLongDistanceMissions = 'UltraLongDistanceMissions',
    MiniaturizedAntimatterRockets = 'MiniaturizedAntimatterRockets',
    AdvancedAntimatterRockets = 'AdvancedAntimatterRockets',
    TerranExodus = 'TerranExodus',
    NearLightSpeeds = 'NearLightSpeeds',
    InterstellarTransports = 'InterstellarTransports',
    InterstellarComponentDesign = 'InterstellarComponentDesign',
    OrbitalShipyards = 'OrbitalShipyards',
    ImprovedComponentDesign = 'ImprovedComponentDesign',
    InterstellarDestroyers = 'InterstellarDestroyers',
    StarshipTheoreticalConcepts = 'StarshipTheoreticalConcepts',
    AdvancedComponentDesign = 'AdvancedComponentDesign',
    InterstellarCruisers = 'InterstellarCruisers',
    QuantumCommunications = 'QuantumCommunications',
    InterstellarBattlecruisers = 'InterstellarBattlecruisers',
    AdvancedTheoreticalConcepts = 'AdvancedTheoreticalConcepts',
    ArtificialIntelligence = 'ArtificialIntelligence',
    InterstellarBattleships = 'InterstellarBattleships',
    HeavyInterstellarTransport = 'HeavyInterstellarTransport',
    RoboticConsciousness = 'RoboticConsciousness'
}

export interface TechEffects {
    buySettlements?: true
    settleHabitability?: number
    terraforms?: number
    terraformDraws?: number
    cvMalfunction?: number
    cvExplorationBonus?: number
    reMalfunction?: number
    reExplorationBonus?: number
    cvMovement?: number
    reMovement?: number
    cvRange?: number
    reRange?: number
    cvMaxSize?: number
    settlementDiscount?: number
    cloning?: true
    cargoBonus?: number
    geneticLevel?: number
    fleetLevel?: number
    mineTerraforming?: true
}

export interface TechDefinition {
    id: TechId
    name: string
    field: TechField
    column: number
    row: number
    cost: number
    prerequisites: readonly TechId[]
    effects: TechEffects
}

export const UNLIMITED = Number.POSITIVE_INFINITY

const B = TechField.Biology
const P = TechField.Physics
const E = TechField.Engineering

export const TECHS: readonly TechDefinition[] = [
    tech(TechId.InterstellarSettlement, 'Interstellar Settlement', B, 1, 2, 10, [], {
        buySettlements: true,
        settleHabitability: 80
    }),
    tech(
        TechId.ImprovedInterstellarExpeditions,
        'Improved Interstellar Expeditions',
        B,
        1,
        3,
        10,
        [],
        {
            cvMalfunction: 45
        }
    ),
    tech(TechId.Terraforming, 'Terraforming', B, 2, 1, 10, [TechId.InterstellarSettlement], {
        terraforms: 1
    }),
    tech(
        TechId.ImprovedInterstellarSettlement,
        'Improved Interstellar Settlement',
        B,
        2,
        2,
        10,
        [TechId.InterstellarSettlement],
        { settleHabitability: 60 }
    ),
    tech(
        TechId.AdvancedInterstellarExpeditions,
        'Advanced Interstellar Expeditions',
        B,
        2,
        3,
        10,
        [TechId.ImprovedInterstellarExpeditions],
        { cvMalfunction: 40 }
    ),
    tech(
        TechId.ImprovedGeneticManipulation,
        'Improved Genetic Manipulation',
        B,
        3,
        1,
        10,
        [TechId.Terraforming, TechId.ImprovedInterstellarSettlement],
        { geneticLevel: 2 }
    ),
    tech(
        TechId.AdvancedInterstellarSettlement,
        'Advanced Interstellar Settlement',
        B,
        3,
        2,
        10,
        [TechId.ImprovedInterstellarSettlement],
        { settleHabitability: 40 }
    ),
    tech(
        TechId.InterstellarLogistics,
        'Interstellar Logistics',
        B,
        3,
        3,
        15,
        [TechId.ImprovedInterstellarSettlement, TechId.AdvancedInterstellarExpeditions],
        { cvMalfunction: 35, cvExplorationBonus: 1 }
    ),
    tech(
        TechId.AdvancedTerraforming,
        'Advanced Terraforming',
        B,
        4,
        1,
        15,
        [TechId.ImprovedGeneticManipulation],
        { terraformDraws: 2 }
    ),
    tech(
        TechId.HarshSpaceEnvironment,
        'Harsh Space Environment',
        B,
        4,
        2,
        10,
        [TechId.ImprovedGeneticManipulation, TechId.AdvancedInterstellarSettlement],
        { settleHabitability: 0 }
    ),
    tech(
        TechId.ImprovedInterstellarLogistics,
        'Improved Interstellar Logistics',
        B,
        4,
        3,
        20,
        [TechId.InterstellarLogistics, TechId.LongDistanceMissions],
        { cvMalfunction: 30, cvExplorationBonus: 2 }
    ),
    tech(
        TechId.AdvancedGeneticManipulation,
        'Advanced Genetic Manipulation',
        B,
        5,
        2,
        20,
        [TechId.AdvancedTerraforming, TechId.HarshSpaceEnvironment],
        { geneticLevel: 3 }
    ),
    tech(
        TechId.AdvancedInterstellarLogistics,
        'Advanced Interstellar Logistics',
        B,
        5,
        3,
        25,
        [TechId.ImprovedInterstellarLogistics],
        { cvMalfunction: 25, cvExplorationBonus: 3 }
    ),
    tech(
        TechId.AtmosphereProcessing,
        'Atmosphere Processing',
        B,
        6,
        2,
        25,
        [TechId.AdvancedGeneticManipulation],
        { mineTerraforming: true }
    ),
    tech(
        TechId.Cloning,
        'Cloning',
        B,
        6,
        3,
        40,
        [TechId.AdvancedGeneticManipulation, TechId.AdvancedInterstellarLogistics],
        { cloning: true }
    ),
    tech(TechId.AdvancedLaserPropulsion, 'Advanced Laser Propulsion', P, 1, 1, 10, [], {
        reMovement: 2
    }),
    tech(TechId.LongDistanceProbes, 'Long Distance Probes', P, 1, 2, 10, [], { reRange: 2 }),
    tech(TechId.FusionRockets, 'Fusion Rockets', P, 1, 3, 10, [], { cvMovement: 4 }),
    tech(
        TechId.UltraLongDistanceProbes,
        'Ultra Long Distance Probes',
        P,
        2,
        1,
        10,
        [TechId.AdvancedLaserPropulsion, TechId.LongDistanceProbes],
        { reRange: UNLIMITED }
    ),
    tech(
        TechId.AdvancedFusionRockets,
        'Advanced Fusion Rockets',
        P,
        2,
        3,
        15,
        [TechId.LongDistanceProbes, TechId.FusionRockets, TechId.InterstellarTransports],
        { cvMovement: 3 }
    ),
    tech(
        TechId.LongDistanceMissions,
        'Long Distance Missions',
        P,
        3,
        1,
        10,
        [TechId.UltraLongDistanceProbes],
        { cvRange: 2 }
    ),
    tech(
        TechId.MiniaturizedFusionRockets,
        'Miniaturized Fusion Rockets',
        P,
        3,
        2,
        15,
        [TechId.UltraLongDistanceProbes, TechId.AdvancedFusionRockets],
        { reMovement: 1 }
    ),
    tech(TechId.BussardRamjets, 'Bussard Ramjets', P, 3, 3, 25, [TechId.AdvancedFusionRockets], {
        cvMovement: 2
    }),
    tech(
        TechId.AntimatterRockets,
        'Antimatter Rockets',
        P,
        4,
        3,
        25,
        [TechId.MiniaturizedFusionRockets, TechId.BussardRamjets],
        { cvMovement: 1.5 }
    ),
    tech(
        TechId.UltraLongDistanceMissions,
        'Ultra Long Distance Missions',
        P,
        5,
        1,
        20,
        [TechId.ImprovedInterstellarLogistics],
        { cvRange: UNLIMITED }
    ),
    tech(
        TechId.MiniaturizedAntimatterRockets,
        'Miniaturized Antimatter Rockets',
        P,
        5,
        2,
        25,
        [TechId.AntimatterRockets],
        { reMovement: 0.5 }
    ),
    tech(
        TechId.AdvancedAntimatterRockets,
        'Advanced Antimatter Rockets',
        P,
        5,
        3,
        30,
        [TechId.AntimatterRockets],
        { cvMovement: 1 }
    ),
    tech(
        TechId.TerranExodus,
        'Terran Exodus',
        P,
        6,
        1,
        40,
        [TechId.UltraLongDistanceMissions, TechId.AdvancedInterstellarLogistics],
        { cvMalfunction: 20, settlementDiscount: 1 }
    ),
    tech(
        TechId.NearLightSpeeds,
        'Near Light Speeds',
        P,
        6,
        3,
        40,
        [TechId.MiniaturizedAntimatterRockets, TechId.AdvancedAntimatterRockets],
        { cvMovement: 0.5 }
    ),
    tech(TechId.InterstellarTransports, 'Interstellar Transports', E, 1, 1, 10, [], {
        cvMaxSize: 3
    }),
    tech(TechId.InterstellarComponentDesign, 'Interstellar Component Design', E, 1, 2, 10, [], {
        reMalfunction: 26
    }),
    tech(
        TechId.OrbitalShipyards,
        'Orbital Shipyards',
        E,
        2,
        1,
        20,
        [TechId.InterstellarTransports, TechId.InterstellarComponentDesign],
        { cvMaxSize: 4 }
    ),
    tech(
        TechId.ImprovedComponentDesign,
        'Improved Component Design',
        E,
        2,
        2,
        10,
        [TechId.InterstellarComponentDesign],
        { reMalfunction: 22 }
    ),
    tech(
        TechId.InterstellarDestroyers,
        'Interstellar Destroyers',
        E,
        3,
        1,
        20,
        [TechId.OrbitalShipyards, TechId.ImprovedComponentDesign, TechId.AdvancedFusionRockets],
        { cvMaxSize: 5 }
    ),
    tech(
        TechId.StarshipTheoreticalConcepts,
        'Starship Theoretical Concepts',
        E,
        3,
        2,
        10,
        [TechId.ImprovedComponentDesign],
        { fleetLevel: 2 }
    ),
    tech(
        TechId.AdvancedComponentDesign,
        'Advanced Component Design',
        E,
        3,
        3,
        10,
        [TechId.ImprovedComponentDesign],
        { reMalfunction: 18 }
    ),
    tech(
        TechId.InterstellarCruisers,
        'Interstellar Cruisers',
        E,
        4,
        1,
        25,
        [TechId.InterstellarDestroyers, TechId.StarshipTheoreticalConcepts, TechId.BussardRamjets],
        { cvMaxSize: 6 }
    ),
    tech(
        TechId.QuantumCommunications,
        'Quantum Communications',
        E,
        4,
        2,
        15,
        [TechId.StarshipTheoreticalConcepts, TechId.AdvancedComponentDesign],
        { reMalfunction: 16, reExplorationBonus: 1 }
    ),
    tech(
        TechId.InterstellarBattlecruisers,
        'Interstellar Battlecruisers',
        E,
        5,
        1,
        25,
        [TechId.InterstellarCruisers, TechId.AntimatterRockets],
        { cvMaxSize: 7 }
    ),
    tech(
        TechId.AdvancedTheoreticalConcepts,
        'Advanced Theoretical Concepts',
        E,
        5,
        2,
        20,
        [TechId.QuantumCommunications],
        { fleetLevel: 3 }
    ),
    tech(
        TechId.ArtificialIntelligence,
        'Artificial Intelligence',
        E,
        5,
        3,
        15,
        [TechId.QuantumCommunications],
        { reMalfunction: 14, reExplorationBonus: 2 }
    ),
    tech(
        TechId.InterstellarBattleships,
        'Interstellar Battleships',
        E,
        6,
        1,
        30,
        [TechId.InterstellarBattlecruisers, TechId.AdvancedTheoreticalConcepts],
        { cvMaxSize: UNLIMITED }
    ),
    tech(
        TechId.HeavyInterstellarTransport,
        'Heavy Interstellar Transport',
        E,
        6,
        2,
        40,
        [TechId.AdvancedTheoreticalConcepts],
        { cargoBonus: 1 }
    ),
    tech(
        TechId.RoboticConsciousness,
        'Robotic Consciousness',
        E,
        6,
        3,
        20,
        [TechId.ArtificialIntelligence],
        { reMalfunction: 12, reExplorationBonus: 3 }
    )
]

function tech(
    id: TechId,
    name: string,
    field: TechField,
    column: number,
    row: number,
    cost: number,
    prerequisites: TechId[],
    effects: TechEffects
): TechDefinition {
    return { id, name, field, column, row, cost, prerequisites, effects }
}

export function techDefinition(techId: TechId): TechDefinition {
    const definition = TECHS.find((candidate) => candidate.id === techId)
    if (!definition) {
        throw new Error(`Unknown tech ${techId}`)
    }
    return definition
}

export function techsThroughColumn(column: number): TechId[] {
    return TECHS.filter((definition) => definition.column <= column).map(
        (definition) => definition.id
    )
}
