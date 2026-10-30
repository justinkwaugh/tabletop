import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPushPiece, isPushPiece } from '../actions/pushPiece.js'
import { HydratedMovePotential, isMovePotential } from '../actions/movePotential.js'
import { HydratedMatrxGameState } from '../model/gameState.js'
import { afterMove } from './turnFlow.js'

type TakingTurnAction = HydratedPushPiece | HydratedMovePotential

export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedMatrxGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedMatrxGameState>
    ): action is TakingTurnAction {
        return isPushPiece(action) || isMovePotential(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMatrxGameState>
    ): ActionType[] {
        const { gameState } = context
        return [
            ...(gameState.pushableKinds(playerId).length > 0 ? [ActionType.PushPiece] : []),
            ...(gameState.potentialMoves(playerId).length > 0 ? [ActionType.MovePotential] : [])
        ]
    }

    enter(context: MachineContext<HydratedMatrxGameState>) {
        const { gameState } = context
        const playerId = gameState.turnManager.currentTurn()?.playerId
        gameState.activePlayerIds = playerId === undefined ? [] : [playerId]
        gameState.resolvingPlayerIds = []
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedMatrxGameState>
    ): MachineState {
        const { gameState } = context
        gameState.movedThisTurn = true
        const tamskOwnerId = isPushPiece(action) ? action.metadata?.tamskOwnerId : undefined
        return afterMove(gameState, action.playerId, tamskOwnerId)
    }
}
