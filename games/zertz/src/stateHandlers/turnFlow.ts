import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { EndReason, HydratedZertzGameState } from '../model/gameState.js'

export function setActivePlayer(gameState: HydratedZertzGameState) {
    const playerId = gameState.turnManager.currentTurn()?.playerId
    assertExists(playerId, 'A turn is under way when a player takes it')
    gameState.activePlayerIds = [playerId]
}

export function stateAfterCapture(gameState: HydratedZertzGameState): MachineState {
    if (gameState.captureChainFrom !== undefined) {
        return MachineState.ContinuingCapture
    }
    return endTurn(gameState)
}

export function endTurn(gameState: HydratedZertzGameState): MachineState {
    const { turnManager } = gameState
    const endedTurn = turnManager.endTurn(gameState.actionCount)
    if (gameState.isOver) {
        return MachineState.EndOfGame
    }
    const nextPlayerId = gameState.opponentOf(endedTurn.playerId)
    if (!gameState.hasLegalMove(nextPlayerId)) {
        gameState.declareWinner(endedTurn.playerId, EndReason.NoMarbles)
        return MachineState.EndOfGame
    }
    turnManager.startNextTurn(gameState.actionCount)
    return MachineState.TakingTurn
}
