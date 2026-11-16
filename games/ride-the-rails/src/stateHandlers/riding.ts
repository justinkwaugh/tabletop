import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedPassJourney, PassJourney, isPassJourney } from '../actions/passJourney.js'
import { HydratedRideJourney, isRideJourney } from '../actions/rideJourney.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { journeyExists } from '../rules/routes.js'
import { passTurn, turnPlayerId } from './flow.js'

type RidingAction = HydratedRideJourney | HydratedPassJourney

// R-3.3: phase 3, in turn order (R-2.2), one journey or pass each.
export class RidingStateHandler implements MachineStateHandler<
    RidingAction,
    HydratedRideTheRailsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRideTheRailsGameState>
    ): action is RidingAction {
        return isRideJourney(action) || isPassJourney(action)
    }

    // R-3.3.1: a journey is the only choice; the pass, with no journey, is taken by itself.
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRideTheRailsGameState>
    ): ActionType[] {
        const state = context.gameState
        return HydratedRideJourney.canRide(state, playerId) ? [ActionType.RideJourney] : []
    }

    // R-3.3.1: a player with no journey to make passes by itself, as a System Action, so no one
    // presses Pass with nothing else to choose.
    enter(context: MachineContext<HydratedRideTheRailsGameState>) {
        const state = context.gameState
        const playerId = turnPlayerId(state)
        state.activePlayerIds = [playerId]
        if (!journeyExists(state)) {
            context.addSystemAction(PassJourney, { playerId })
        }
    }

    // R-2.1: the end of round follows the last journey; the Ride phase closes with it.
    onAction(
        _action: RidingAction,
        context: MachineContext<HydratedRideTheRailsGameState>
    ): MachineState {
        return passTurn(context.gameState, PhaseName.Ride)
            ? MachineState.Riding
            : MachineState.EndingRound
    }
}
