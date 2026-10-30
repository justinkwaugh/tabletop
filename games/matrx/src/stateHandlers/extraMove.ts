import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedExtraMove, isExtraMove } from '../actions/extraMove.js'
import { HydratedSkipExtraMove, isSkipExtraMove } from '../actions/skipExtraMove.js'
import { HydratedMatrxGameState } from '../model/gameState.js'
import { afterMove } from './turnFlow.js'

type ExtraMoveAction = HydratedExtraMove | HydratedSkipExtraMove

export class ExtraMoveStateHandler implements MachineStateHandler<
    ExtraMoveAction,
    HydratedMatrxGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedMatrxGameState>
    ): action is ExtraMoveAction {
        return isExtraMove(action) || isSkipExtraMove(action)
    }

    validActionsForPlayer(
        _playerId: string,
        context: MachineContext<HydratedMatrxGameState>
    ): ActionType[] {
        const canPush = context.gameState.board.legalEntries().length > 0
        return canPush
            ? [ActionType.ExtraMove, ActionType.SkipExtraMove]
            : [ActionType.SkipExtraMove]
    }

    enter(context: MachineContext<HydratedMatrxGameState>) {
        const { gameState } = context
        const playerId = gameState.turnManager.currentTurn()?.playerId
        gameState.activePlayerIds = playerId === undefined ? [] : [playerId]
        gameState.resolvingPlayerIds = []
    }

    onAction(
        action: ExtraMoveAction,
        context: MachineContext<HydratedMatrxGameState>
    ): MachineState {
        const tamskOwnerId = isExtraMove(action) ? action.metadata?.tamskOwnerId : undefined
        return afterMove(context.gameState, action.playerId, tamskOwnerId)
    }
}
