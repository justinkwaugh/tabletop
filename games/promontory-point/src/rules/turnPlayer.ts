import { assertExists } from '@tabletop/common'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'

// R-2.1, R-2.2: the turn the turn manager has open belongs to the player taking it.
export function turnPlayerId(state: HydratedPromontoryPointGameState): string {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'A turn is open whenever a turn player is asked for')
    return turn.playerId
}
