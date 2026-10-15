import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceMarble, isPlaceMarble } from '../actions/placeMarble.js'
import { HydratedCapture, isCapture } from '../actions/capture.js'
import { HydratedZertzGameState } from '../model/gameState.js'
import { setActivePlayer, stateAfterCapture, stateAfterPlacement } from './turnFlow.js'

type TakingTurnAction = HydratedPlaceMarble | HydratedCapture

export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedZertzGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedZertzGameState>
    ): action is TakingTurnAction {
        return isPlaceMarble(action) || isCapture(action)
    }

    validActionsForPlayer(
        _playerId: string,
        context: MachineContext<HydratedZertzGameState>
    ): ActionType[] {
        return context.gameState.board.hasAnyJump()
            ? [ActionType.Capture]
            : [ActionType.PlaceMarble]
    }

    enter(context: MachineContext<HydratedZertzGameState>) {
        setActivePlayer(context.gameState)
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedZertzGameState>
    ): MachineState {
        const { gameState } = context
        switch (true) {
            case isPlaceMarble(action):
                return stateAfterPlacement(gameState)
            case isCapture(action):
                return stateAfterCapture(gameState)
            default:
                throw Error('Invalid action type')
        }
    }
}
