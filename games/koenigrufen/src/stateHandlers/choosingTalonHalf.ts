import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedChooseTalonHalf, isChooseTalonHalf } from '../actions/chooseTalonHalf.js'
import { HydratedGiveUp, isGiveUp } from '../actions/giveUp.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

type ChoosingTalonHalfAction = HydratedChooseTalonHalf | HydratedGiveUp

// Taking a half when the called King is in the talon means playing alone.
export class ChoosingTalonHalfStateHandler implements MachineStateHandler<
    ChoosingTalonHalfAction,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is ChoosingTalonHalfAction {
        return isChooseTalonHalf(action) || isGiveUp(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): ActionType[] {
        const state = context.gameState
        if (playerId !== state.declarerId()) {
            return []
        }
        return state.canGiveUp(playerId)
            ? [ActionType.ChooseTalonHalf, ActionType.GiveUp]
            : [ActionType.ChooseTalonHalf]
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        const state = context.gameState
        state.beginTurn(state.declarerId())
    }

    onAction(
        action: ChoosingTalonHalfAction,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): MachineState {
        context.gameState.finishTurn()
        return isGiveUp(action) ? MachineState.EndingHand : MachineState.LayingAway
    }
}
