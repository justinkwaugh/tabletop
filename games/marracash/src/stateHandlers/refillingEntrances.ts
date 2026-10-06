import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMarracashGameState } from '../model/gameState.js'
import { HydratedBringVisitors, isBringVisitors } from '../actions/bringVisitors.js'
import { queueTurnCommit } from '../util/automaticActions.js'
import { activateTurnPlayer } from '../util/turns.js'

type RefillingEntrancesAction = HydratedBringVisitors

export class RefillingEntrancesStateHandler implements MachineStateHandler<
    RefillingEntrancesAction,
    HydratedMarracashGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedMarracashGameState>
    ): action is RefillingEntrancesAction {
        const gameState = context.gameState
        return (
            isBringVisitors(action) &&
            gameState.activePlayerIds.includes(action.playerId) &&
            gameState.canBringVisitors(action.count, action.entranceId)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMarracashGameState>
    ): ActionType[] {
        return context.gameState.activePlayerIds.includes(playerId)
            ? [ActionType.BringVisitors]
            : []
    }

    enter(context: MachineContext<HydratedMarracashGameState>) {
        activateTurnPlayer(context.gameState)
    }

    onAction(
        _action: RefillingEntrancesAction,
        context: MachineContext<HydratedMarracashGameState>
    ): MachineState {
        if (context.gameState.needsRefill()) {
            return MachineState.RefillingEntrances
        }
        queueTurnCommit(context)
        return MachineState.EndingTurn
    }
}
