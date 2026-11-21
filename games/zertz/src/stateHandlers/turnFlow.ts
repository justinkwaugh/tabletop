import { assertExists, type HydratedAction, type MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Capture } from '../actions/capture.js'
import { autoJumpProblem, HydratedSetAutoJump } from '../actions/setAutoJump.js'
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
    if (gameState.recordPosition(nextPlayerId)) {
        gameState.declareDraw()
        return MachineState.EndOfGame
    }
    turnManager.startNextTurn(gameState.actionCount)
    return MachineState.TakingTurn
}

// Either player may turn auto-jump on or off as the game goes on, unless it is on for both.
export function withAutoJump(types: ActionType[], gameState: HydratedZertzGameState): ActionType[] {
    return gameState.autoJumpForAll === true ? types : [...types, ActionType.SetAutoJump]
}

export function isAutoJumpDeclaration(
    action: HydratedAction,
    gameState: HydratedZertzGameState
): action is HydratedSetAutoJump {
    return action instanceof HydratedSetAutoJump && autoJumpProblem(gameState, action) === undefined
}

// The player to move makes the only jump open to them at once if they auto-jump. Entering a state
// after every action, a declaration turning it on during their own turn makes the jump too.
export function queueAutoJump(context: MachineContext<HydratedZertzGameState>) {
    const { gameState } = context
    const playerId = gameState.turnManager.currentTurn()?.playerId
    assertExists(playerId, 'A turn is under way when a player takes it')
    const jump = gameState.autoJumpFor(playerId)
    if (jump === undefined) return
    context.addSystemAction(Capture, {
        playerId,
        from: structuredClone(jump.from),
        to: structuredClone(jump.to)
    })
}
