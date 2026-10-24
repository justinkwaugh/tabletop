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

// Rulebook 1.1: every transfer marker drops by one. The campaign does it after the economic
// phase, as rule 1.0 orders the turn, so ships arriving are not yet there for blockades.
export function dropTransferMarkers(state: HydratedStellarHorizonsGameState): string[] {
    const arrivedShipIds: string[] = []
    for (const ship of state.allShips()) {
        if (ship.transit > 0) {
            ship.transit -= 1
            if (ship.transit === 0) {
                arrivedShipIds.push(ship.shipId)
            }
        }
    }
    return arrivedShipIds
}

export function beginTurn(state: HydratedStellarHorizonsGameState): TurnStart {
    const arrivedShipIds = isCampaign(state) ? [] : dropTransferMarkers(state)
    for (const ship of state.allShips()) {
        ship.loadedFromBase = false
        ship.explored = false
    }
    // Rulebook 1.7's exception looks back to the turn before.
    state.attacks = state.attacks.filter((attack) => attack.year >= state.year - DECADE)
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
