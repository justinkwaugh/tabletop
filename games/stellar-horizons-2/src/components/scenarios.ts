import { Sector } from './systems.js'

export enum ScenarioId {
    Footfall = 'Footfall',
    Voyages = 'Voyages'
}

export enum VictoryKind {
    Settlements = 'Settlements',
    Anomalies = 'Anomalies'
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

export type ScenarioVictory = SettlementVictory | AnomalyVictory

export interface StartingBase {
    settlements: number
    systemIds: readonly string[]
}

export interface ScenarioAnomalies {
    chance: number
    rewards: boolean
}

export interface ScenarioDefinition {
    id: ScenarioId
    name: string
    minPlayers: number
    sectors: readonly Sector[]
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
    victory: ScenarioVictory
}

export const FOOTFALL: ScenarioDefinition = {
    id: ScenarioId.Footfall,
    name: 'Footfall among the Stars',
    minPlayers: 1,
    sectors: [Sector.Sol, Sector.AlphaCentauri],
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
    sectors: [
        Sector.Sol,
        Sector.AlphaCentauri,
        Sector.Altair,
        Sector.DeltaPavonis,
        Sector.GammaSerpentis,
        Sector.BetaAquilae
    ],
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

export const SCENARIOS: readonly ScenarioDefinition[] = [FOOTFALL, VOYAGES]

export function scenarioDefinition(scenarioId: ScenarioId): ScenarioDefinition {
    switch (scenarioId) {
        case ScenarioId.Footfall:
            return FOOTFALL
        case ScenarioId.Voyages:
            return VOYAGES
    }
}

export function settlementVictory(scenario: ScenarioDefinition): SettlementVictory | undefined {
    return scenario.victory.kind === VictoryKind.Settlements ? scenario.victory : undefined
}

export function isEvenDecade(year: number): boolean {
    return Math.floor(year / 10) % 2 === 0
}
