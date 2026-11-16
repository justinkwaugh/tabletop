import { MachineContext } from '@tabletop/common'
import { RideTheRailsStateHandlers } from '../definition/stateHandlers.js'
import type { RideTheRailsGameState } from '../model/gameState.js'
import { fixturePlayerIds, hydrated } from './fixtures.js'

export function offersByPlayer(state: RideTheRailsGameState): Record<string, string[]> {
    const gameState = hydrated(state)
    const context = new MachineContext({ gameConfig: {}, gameState })
    const handler = RideTheRailsStateHandlers[gameState.machineState]
    return Object.fromEntries(
        fixturePlayerIds(gameState.players.length).map((playerId) => [
            playerId,
            handler.validActionsForPlayer(playerId, context)
        ])
    )
}
