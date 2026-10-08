import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedChooseStartCity, isChooseStartCity } from '../actions/chooseStartCity.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export class ChoosingStartCitiesStateHandler implements MachineStateHandler<
    HydratedChooseStartCity,
    HydratedKoggeGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedKoggeGameState>
    ): action is HydratedChooseStartCity {
        return (
            isChooseStartCity(action) &&
            context.gameState.pendingStartChoosers().includes(action.playerId)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoggeGameState>
    ): ActionType[] {
        return HydratedChooseStartCity.canChooseStartCity(context.gameState, playerId)
            ? [ActionType.ChooseStartCity]
            : []
    }

    enter(context: MachineContext<HydratedKoggeGameState>) {
        context.gameState.activePlayerIds = context.gameState.pendingStartChoosers()
    }

    onAction(
        _action: HydratedChooseStartCity,
        context: MachineContext<HydratedKoggeGameState>
    ): MachineState {
        return context.gameState.pendingStartChoosers().length === 0
            ? MachineState.RevealingStartCities
            : MachineState.ChoosingStartCities
    }
}
