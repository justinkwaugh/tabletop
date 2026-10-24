import { isEvenDecade } from '../components/scenarios.js'
import { gainInfluence, isCampaign } from './campaign.js'
import { capabilitiesOf } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'

export const DECADE = 10

export interface TurnInfluence {
    playerId: string
    amount: number
}

export interface TurnStart {
    income: number
    arrivedShipIds: string[]
    // The IP cards give at the start of each turn (Increased Body Size).
    influence: TurnInfluence[]
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
        base.goodsReceived = 0
    }
    const income = isEvenDecade(state.year) ? state.scenarioDefinition().evenDecadeIncome : 0
    for (const player of state.players) {
        player.cash += income
        player.remoteRepairUsed = false
        player.fieldsDeveloped = []
        player.operations = []
        player.breakthroughs = []
        player.settlementsBought = 0
    }
    const influence = isCampaign(state)
        ? state
              .initiativeOrder()
              .map((playerId) => ({
                  playerId,
                  amount: capabilitiesOf(state, playerId).influencePerTurn
              }))
              .filter(({ amount }) => amount > 0)
        : []
    for (const { playerId, amount } of influence) {
        gainInfluence(state, playerId, amount)
    }
    return { income, arrivedShipIds, influence }
}

export function isFinalTurn(state: HydratedStellarHorizonsGameState): boolean {
    const endYear = state.scenarioDefinition().endYear
    return endYear !== undefined && state.year >= endYear
}
