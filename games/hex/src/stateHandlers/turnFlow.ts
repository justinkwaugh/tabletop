import { assertExists } from '@tabletop/common'
import { HydratedHexGameState } from '../model/gameState.js'

export function turnHolder(state: HydratedHexGameState): string {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'A stone is placed or colours swapped only during a turn')
    return turn.playerId
}
