import { isEvenDecade } from '../components/scenarios.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'

export const DECADE = 10

export interface TurnStart {
    income: number
    arrivedShipIds: string[]
}

export function beginTurn(state: HydratedStellarHorizonsGameState): TurnStart {
    const arrivedShipIds: string[] = []
    for (const ship of state.allShips()) {
        if (ship.transit > 0) {
            ship.transit -= 1
            if (ship.transit === 0) {
                arrivedShipIds.push(ship.shipId)
            }
        }
        ship.loadedFromBase = false
        ship.explored = false
    }
    for (const base of state.allBases()) {
        base.spent = 0
        base.cloned = false
    }
    const income = isEvenDecade(state.year) ? state.scenarioDefinition().evenDecadeIncome : 0
    for (const player of state.players) {
        player.cash += income
        player.remoteRepairUsed = false
        player.fieldsDeveloped = []
        player.operations = []
        player.breakthroughs = []
    }
    return { income, arrivedShipIds }
}

export function isFinalTurn(state: HydratedStellarHorizonsGameState): boolean {
    const endYear = state.scenarioDefinition().endYear
    return endYear !== undefined && state.year >= endYear
}
