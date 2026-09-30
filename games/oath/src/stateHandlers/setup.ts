import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSetupChoice, isSetupChoice } from '../actions/setupChoice.js'
import { isSetupComplete, nextSetupPlayerId } from '../model/setup.js'

// R-1.23.1 to R-1.23.3 — progress is read off the board.
export class SetupStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): boolean {
        if (!action.playerId) return false
        if (action.type === ActionType.SetupChoice) {
            return HydratedSetupChoice.canDoSetupChoice(context.gameState, action.playerId)
        }
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        return HydratedSetupChoice.canDoSetupChoice(context.gameState, playerId)
            ? [ActionType.SetupChoice]
            : []
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        const state = context.gameState
        // No turn is opened: R-4 has not started one.
        const waitingOn = nextSetupPlayerId(state)
        state.activePlayerIds = waitingOn ? [waitingOn] : []
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        if (isSetupChoice(action)) {
            // R-1.23 is per player; stay until the last pawn is placed.
            return isSetupComplete(context.gameState) ? MachineState.WakePhase : MachineState.Setup
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
