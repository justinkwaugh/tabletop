import type { HydratedReefEncounterGameState } from '../model/gameState.js'

export function activateTurnPlayer(gameState: HydratedReefEncounterGameState) {
    const playerId =
        gameState.turnManager.currentTurn()?.playerId ??
        gameState.turnManager.startNextTurn(gameState.actionCount)
    gameState.activePlayerIds = [playerId]
}

export function endTurnInOrder(
    gameState: HydratedReefEncounterGameState,
    playerId: string
): boolean {
    gameState.turnManager.endTurn(gameState.actionCount)
    return gameState.isLastInTurnOrder(playerId)
}
