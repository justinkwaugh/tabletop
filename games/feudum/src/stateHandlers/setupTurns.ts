import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-1.4.8, R-1.4.9 Asks the next seat in turn order; after the last seat, the first again. */
export function askNextSetupSeat(state: HydratedFeudumGameState): void {
    const playerId = state.turnManager.startNextTurn(state.actionCount)
    state.flow.setupOrder = { playerId }
    state.activePlayerIds = [playerId]
}

/** R-1.4.8, R-1.4.9 Ends the seat's turn; whether every seat has now been asked. */
export function endSetupTurn(state: HydratedFeudumGameState, playerId: string): boolean {
    state.turnManager.endTurn(state.actionCount)
    return state.turnManager.turnOrder.at(-1) === playerId
}
