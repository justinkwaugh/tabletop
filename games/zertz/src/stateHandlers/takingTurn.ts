import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceMarble, isPlaceMarble } from '../actions/placeMarble.js'
import { HydratedCapture, isCapture } from '../actions/capture.js'
import { HydratedSetAutoJump, isSetAutoJump } from '../actions/setAutoJump.js'
import { HydratedZertzGameState } from '../model/gameState.js'
import {
    endTurn,
    isAutoJumpDeclaration,
    queueAutoJump,
    setActivePlayer,
    stateAfterCapture,
    withAutoJump
} from './turnFlow.js'

type TakingTurnAction = HydratedPlaceMarble | HydratedCapture | HydratedSetAutoJump

export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedZertzGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedZertzGameState>
    ): action is TakingTurnAction {
        return (
            isPlaceMarble(action) ||
            isCapture(action) ||
            isAutoJumpDeclaration(action, context.gameState)
        )
    }

    validActionsForPlayer(
        _playerId: string,
        context: MachineContext<HydratedZertzGameState>
    ): ActionType[] {
        const { gameState } = context
        return withAutoJump(
            [gameState.board.hasAnyJump() ? ActionType.Capture : ActionType.PlaceMarble],
            gameState
        )
    }

    enter(context: MachineContext<HydratedZertzGameState>) {
        setActivePlayer(context.gameState)
        queueAutoJump(context)
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedZertzGameState>
    ): MachineState {
        const { gameState } = context
        switch (true) {
            case isPlaceMarble(action):
                return endTurn(gameState)
            case isCapture(action):
                return stateAfterCapture(gameState)
            case isSetAutoJump(action):
                return MachineState.TakingTurn
            default:
                throw Error('Invalid action type')
        }
    }
}
