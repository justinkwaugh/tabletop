import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedPlaceStartingBase, isPlaceStartingBase } from '../actions/placeStartingBase.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { nextStartingBasePlacer } from '../model/startingBases.js'

export class PlacingStartingBasesStateHandler implements MachineStateHandler<
    HydratedPlaceStartingBase,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedPlaceStartingBase {
        return isPlaceStartingBase(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.PlaceStartingBase] : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        const next = nextStartingBasePlacer(state)
        state.activePlayerIds = next ? [next] : []
    }

    onAction(
        _action: HydratedPlaceStartingBase,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return nextStartingBasePlacer(context.gameState)
            ? MachineState.PlacingStartingBases
            : MachineState.StartOfTurn
    }
}
