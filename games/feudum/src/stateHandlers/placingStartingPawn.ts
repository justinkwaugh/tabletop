import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedPlaceStartingPawn, isPlaceStartingPawn } from '../actions/placeStartingPawn.js'
import { StartRound } from '../actions/startRound.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { askNextSetupSeat, endSetupTurn } from './setupTurns.js'

/** R-1.4.9, R-2.2 Seat by seat in turn order, each places one pawn; after the last, `StartRound`. */
export class PlacingStartingPawnStateHandler implements MachineStateHandler<
    HydratedPlaceStartingPawn,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedPlaceStartingPawn {
        return isPlaceStartingPawn(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return context.gameState.flow.setupOrder?.playerId === playerId
            ? [ActionType.PlaceStartingPawn]
            : []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        askNextSetupSeat(context.gameState)
    }

    onAction(
        action: HydratedPlaceStartingPawn,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        const state = context.gameState
        if (!endSetupTurn(state, action.playerId)) {
            return MachineState.PlacingStartingPawn
        }
        state.flow.setupOrder = undefined
        context.addSystemAction(StartRound)
        return MachineState.SelectingHands
    }
}
