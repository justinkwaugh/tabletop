import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedCapture, isCapture } from '../actions/capture.js'
import { HydratedSetAutoJump, isSetAutoJump } from '../actions/setAutoJump.js'
import { HydratedZertzGameState } from '../model/gameState.js'
import {
    isAutoJumpDeclaration,
    queueAutoJump,
    setActivePlayer,
    stateAfterCapture,
    withAutoJump
} from './turnFlow.js'

type ContinuingCaptureAction = HydratedCapture | HydratedSetAutoJump

export class ContinuingCaptureStateHandler implements MachineStateHandler<
    ContinuingCaptureAction,
    HydratedZertzGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedZertzGameState>
    ): action is ContinuingCaptureAction {
        return isCapture(action) || isAutoJumpDeclaration(action, context.gameState)
    }

    validActionsForPlayer(
        _playerId: string,
        context: MachineContext<HydratedZertzGameState>
    ): ActionType[] {
        return withAutoJump([ActionType.Capture], context.gameState)
    }

    enter(context: MachineContext<HydratedZertzGameState>) {
        setActivePlayer(context.gameState)
        queueAutoJump(context)
    }

    onAction(
        action: ContinuingCaptureAction,
        context: MachineContext<HydratedZertzGameState>
    ): MachineState {
        return isSetAutoJump(action)
            ? MachineState.ContinuingCapture
            : stateAfterCapture(context.gameState)
    }
}
