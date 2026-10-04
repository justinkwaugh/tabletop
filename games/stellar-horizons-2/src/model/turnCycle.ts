import { isEvenDecade } from '../components/scenarios.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { TurnStep } from './turn.js'

export const DECADE = 10

export interface TurnStart {
    income: number
    arrivedShipIds: string[]
}

export function beginTurn(state: HydratedStellarHorizonsGameState): TurnStart {
    const arrivedShipIds: string[] = []
    for (const ship of state.ships) {
        if (ship.transit > 0) {
            ship.transit -= 1
            if (ship.transit === 0) {
                arrivedShipIds.push(ship.shipId)
            }
        }
        ship.loadedFromBase = false
        ship.explored = false
    }
    for (const base of state.bases) {
        base.spent = 0
        base.cloned = false
    }
    const income = isEvenDecade(state.year) ? state.scenarioDefinition().evenDecadeIncome : 0
    for (const player of state.players) {
        player.cash += income
        player.step = TurnStep.Build
        player.remoteRepairUsed = false
        player.fieldsDeveloped = []
    }
    return { income, arrivedShipIds }
}

export function isFinalTurn(state: HydratedStellarHorizonsGameState): boolean {
    return state.year >= state.scenarioDefinition().endYear
}

export function activeTurnPlayers(state: HydratedStellarHorizonsGameState): string[] {
    return state
        .initiativeOrder()
        .filter((playerId) => state.getPlayerState(playerId).step !== TurnStep.Done)
}
