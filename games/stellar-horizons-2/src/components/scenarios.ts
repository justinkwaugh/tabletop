import { TURN_PHASES, TurnPhase } from '../model/turn.js'
import { Sector } from './systems.js'
import { WorldClass } from './worldTypes.js'

export enum ScenarioId {
    Footfall = 'Footfall',
    Voyages = 'Voyages',
    Campaign = 'Campaign'
}

export enum VictoryKind {
    Settlements = 'Settlements',
    Anomalies = 'Anomalies',
    Score = 'Score'
}

export interface SettlementVictory {
    kind: VictoryKind.Settlements
    settlements: number
    systemPopulation: number
}

export interface AnomalyVictory {
    kind: VictoryKind.Anomalies
    resolved: number
    ofEachChallenge: number
}

export interface ScoreVictory {
    kind: VictoryKind.Score
}

export type ScenarioVictory = SettlementVictory | AnomalyVictory | ScoreVictory

export interface StartingBase {
    settlements: number
    systemIds: readonly string[]
}

export interface ScenarioAnomalies {
    chance: number
    rewards: boolean
}

// Rules only the campaign uses (rulebook 3.0 and 4.0).
export interface CampaignRules {
    setAsideWorlds: Partial<Record<WorldClass, number>>
    endRollYear: number
    // The end of the first turn whose end rolls for the truce, at this chance, rising 1% a turn.
    truce: { rollYear: number; chance: number }
}

export interface ScenarioDefinition {
    id: ScenarioId
    name: string
    minPlayers: number
    maxPlayers: number
    sectors: readonly Sector[]
    phases: readonly TurnPhase[]
    firstTurnPhases?: readonly TurnPhase[]
    startYear: number
    endYear?: number
    techColumns: number
    explorationMarkerValue: number
    surveyedAroundSol: boolean
    startingBase?: StartingBase
    startingCash: number
    startingTechMarkersPerField: number
    evenDecadeIncome: number
    settlementCost: number
    terraforming: boolean
    anomalies?: ScenarioAnomalies
    campaign?: CampaignRules
    victory: ScenarioVictory
}

export const FOOTFALL: ScenarioDefinition = {
    id: ScenarioId.Footfall,
    name: 'Footfall among the Stars',
    minPlayers: 1,
    maxPlayers: 4,
    sectors: [Sector.Sol, Sector.AlphaCentauri],
    phases: TURN_PHASES,
    startYear: 2150,
    endYear: 2300,
    techColumns: 1,
    explorationMarkerValue: 5,
    surveyedAroundSol: false,
    startingCash: 30,
    startingTechMarkersPerField: 1,
    evenDecadeIncome: 10,
    settlementCost: 5,
    terraforming: true,
    victory: { kind: VictoryKind.Settlements, settlements: 10, systemPopulation: 25 }
}

export const VOYAGES: ScenarioDefinition = {
    id: ScenarioId.Voyages,
    name: 'These are the Voyages',
    minPlayers: 2,
    maxPlayers: 4,
    sectors: [
        Sector.Sol,
        Sector.AlphaCentauri,
        Sector.Altair,
        Sector.DeltaPavonis,
        Sector.GammaSerpentis,
        Sector.BetaAquilae
    ],
    phases: TURN_PHASES,
    startYear: 2250,
    techColumns: 3,
    explorationMarkerValue: 5,
    surveyedAroundSol: true,
    startingBase: {
        settlements: 25,
        systemIds: ['barnards-star', 'luhman-16', 'alpha-centauri']
    },
    startingCash: 25,
    startingTechMarkersPerField: 1,
    evenDecadeIncome: 5,
    settlementCost: 5,
    terraforming: false,
    anomalies: { chance: 20, rewards: false },
    victory: { kind: VictoryKind.Anomalies, resolved: 4, ofEachChallenge: 1 }
}

// Rulebook 3.0.
export const CAMPAIGN: ScenarioDefinition = {
    id: ScenarioId.Campaign,
    name: 'Campaign',
    minPlayers: 1,
    maxPlayers: 7,
    sectors: Object.values(Sector),
    phases: TURN_PHASES,
    firstTurnPhases: [TurnPhase.Exploration, TurnPhase.Development],
    startYear: 2100,
    techColumns: 0,
    explorationMarkerValue: 5,
    surveyedAroundSol: false,
    startingCash: 0,
    startingTechMarkersPerField: 0,
    evenDecadeIncome: 0,
    settlementCost: 5,
    terraforming: true,
    anomalies: { chance: 20, rewards: true },
    campaign: {
        setAsideWorlds: {
            [WorldClass.M]: 8,
            [WorldClass.O]: 6,
            [WorldClass.L]: 6,
            [WorldClass.H]: 6
        },
        endRollYear: 2500,
        truce: { rollYear: 2110, chance: 1 }
    },
    victory: { kind: VictoryKind.Score }
}

export const SCENARIOS: readonly ScenarioDefinition[] = [FOOTFALL, VOYAGES, CAMPAIGN]

export function scenarioDefinition(scenarioId: ScenarioId): ScenarioDefinition {
    switch (scenarioId) {
        case ScenarioId.Footfall:
            return FOOTFALL
        case ScenarioId.Voyages:
            return VOYAGES
        case ScenarioId.Campaign:
            return CAMPAIGN
    }
}

export function settlementVictory(scenario: ScenarioDefinition): SettlementVictory | undefined {
    return scenario.victory.kind === VictoryKind.Settlements ? scenario.victory : undefined
}

export function isEvenDecade(year: number): boolean {
    return Math.floor(year / 10) % 2 === 0
}
