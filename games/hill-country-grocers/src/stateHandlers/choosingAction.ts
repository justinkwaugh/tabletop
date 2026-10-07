import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedChooseAction, isChooseAction } from '../actions/chooseAction.js'
import { ActionSpace } from '../model/actionSpaces.js'
import type { HydratedHcgGameState } from '../model/gameState.js'

const NEXT_STATE: Record<ActionSpace, MachineState> = {
    [ActionSpace.BuildNetwork]: MachineState.BuildingNetwork,
    [ActionSpace.DevelopTowns]: MachineState.DevelopingTowns,
    [ActionSpace.AuctionShare]: MachineState.StartingAuction
}

export class ChoosingActionStateHandler implements MachineStateHandler<
    HydratedChooseAction,
    HydratedHcgGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHcgGameState>
    ): action is HydratedChooseAction {
        return isChooseAction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedHcgGameState>
    ): ActionType[] {
        return HydratedChooseAction.canChoose(context.gameState, playerId)
            ? [ActionType.ChooseAction]
            : []
    }

    enter(context: MachineContext<HydratedHcgGameState>) {
        const state = context.gameState
        if (!state.turnManager.currentTurn()) {
            if (state.turnManager.series.length === 0) {
                state.turnManager.startTurn(state.firstActingPlayerId(), state.actionCount)
            } else {
                state.turnManager.startNextTurn(state.actionCount)
            }
        }
        state.activePlayerIds = [state.turnPlayerId()]
    }

    onAction(
        action: HydratedChooseAction,
        _context: MachineContext<HydratedHcgGameState>
    ): MachineState {
        return NEXT_STATE[action.space]
    }
}
