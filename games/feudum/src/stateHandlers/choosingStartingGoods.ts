import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import {
    HydratedChooseStartingGoods,
    isChooseStartingGoods
} from '../actions/chooseStartingGoods.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { setupSeat } from '../model/turns.js'
import { askNextSetupSeat, endSetupTurn } from './setupTurns.js'

/** R-1.4.8 Seat by seat in turn order, each takes three starting goods. */
export class ChoosingStartingGoodsStateHandler implements MachineStateHandler<
    HydratedChooseStartingGoods,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedChooseStartingGoods {
        return isChooseStartingGoods(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return setupSeat(context.gameState) === playerId ? [ActionType.ChooseStartingGoods] : []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        askNextSetupSeat(context.gameState)
    }

    onAction(
        action: HydratedChooseStartingGoods,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return endSetupTurn(context.gameState, action.playerId)
            ? MachineState.PlacingStartingPawn
            : MachineState.ChoosingStartingGoods
    }
}
