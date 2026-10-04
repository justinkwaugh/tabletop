import { Sector } from './systems.js'

export enum ScenarioId {
    Footfall = 'Footfall'
}

export interface ScenarioDefinition {
    id: ScenarioId
    name: string
    sectors: readonly Sector[]
    startYear: number
    endYear: number
    techColumns: number
    explorationMarkerValue: number
    startingCash: number
    startingTechMarkersPerField: number
    evenDecadeIncome: number
    settlementCost: number
    victorySettlements: number
    victorySystemPopulation: number
}

export const FOOTFALL: ScenarioDefinition = {
    id: ScenarioId.Footfall,
    name: 'Footfall among the Stars',
    sectors: [Sector.Sol, Sector.AlphaCentauri],
    startYear: 2150,
    endYear: 2300,
    techColumns: 1,
    explorationMarkerValue: 5,
    startingCash: 30,
    startingTechMarkersPerField: 1,
    evenDecadeIncome: 10,
    settlementCost: 5,
    victorySettlements: 10,
    victorySystemPopulation: 25
}

export function scenarioDefinition(scenarioId: ScenarioId): ScenarioDefinition {
    switch (scenarioId) {
        case ScenarioId.Footfall:
            return FOOTFALL
    }
}

export function isEvenDecade(year: number): boolean {
    return Math.floor(year / 10) % 2 === 0
}
