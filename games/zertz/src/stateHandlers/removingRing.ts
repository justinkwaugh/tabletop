import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedRemoveRing, isRemoveRing } from '../actions/removeRing.js'
import { HydratedZertzGameState } from '../model/gameState.js'
import { endTurn, setActivePlayer } from './turnFlow.js'

export class RemovingRingStateHandler implements MachineStateHandler<
    HydratedRemoveRing,
    HydratedZertzGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedZertzGameState>
    ): action is HydratedRemoveRing {
        return isRemoveRing(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedZertzGameState>
    ): ActionType[] {
        return [ActionType.RemoveRing]
    }

    enter(context: MachineContext<HydratedZertzGameState>) {
        setActivePlayer(context.gameState)
    }

    onAction(
        _action: HydratedRemoveRing,
        context: MachineContext<HydratedZertzGameState>
    ): MachineState {
        return endTurn(context.gameState)
    }
}
