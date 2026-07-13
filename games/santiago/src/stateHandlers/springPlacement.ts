import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceSpring, isPlaceSpring } from '../actions/placeSpring.js'
import { validSpringPlacements } from '../util/placement.js'

// One-time setup step, before round 1 begins: the first player (seatOrder[0]) places the
// spring anywhere except the four corner intersections. Only reached when the game's
// "Randomize Spring Location" config option is off — otherwise the spring is placed
// randomly during game initialization and play starts directly in Bidding.
export class SpringPlacementStateHandler
    implements MachineStateHandler<HydratedPlaceSpring, HydratedSantiagoGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedSantiagoGameState>
    ): action is HydratedPlaceSpring {
        if (!isPlaceSpring(action)) return false
        if (!action.playerId) return false
        const state = context.gameState
        if (action.playerId !== state.seatOrder[0]) return false
        return validSpringPlacements().some((p) => p.col === action.col && p.row === action.row)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSantiagoGameState>
    ): ActionType[] {
        const state = context.gameState
        return playerId === state.seatOrder[0] ? [ActionType.PlaceSpring] : []
    }

    enter(context: MachineContext<HydratedSantiagoGameState>) {
        context.gameState.activePlayerIds = [context.gameState.seatOrder[0]]
    }

    onAction(
        _action: HydratedPlaceSpring,
        _context: MachineContext<HydratedSantiagoGameState>
    ): MachineState {
        return MachineState.Bidding
    }
}
