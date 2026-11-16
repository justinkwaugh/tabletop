import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedCapture, isCapture } from '../actions/capture.js'
import { HydratedZertzGameState } from '../model/gameState.js'
import { setActivePlayer, stateAfterCapture } from './turnFlow.js'

export class ContinuingCaptureStateHandler implements MachineStateHandler<
    HydratedCapture,
    HydratedZertzGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedZertzGameState>
    ): action is HydratedCapture {
        return isCapture(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedZertzGameState>
    ): ActionType[] {
        return [ActionType.Capture]
    }

    enter(context: MachineContext<HydratedZertzGameState>) {
        setActivePlayer(context.gameState)
    }

    onAction(
        _action: HydratedCapture,
        context: MachineContext<HydratedZertzGameState>
    ): MachineState {
        return stateAfterCapture(context.gameState)
    }
}
