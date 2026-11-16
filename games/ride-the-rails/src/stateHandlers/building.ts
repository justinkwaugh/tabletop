import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedEndBuilding, isEndBuilding } from '../actions/endBuilding.js'
import {
    HydratedFinishBuilding,
    isFinishBuilding,
    scheduleFinishBuilding
} from '../actions/finishBuilding.js'
import { HydratedPlaceLocomotive } from '../actions/placeLocomotive.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { endPhase, passTurn, startPhase, turnPlayerId } from './flow.js'

type BuildingAction = HydratedPlaceLocomotive | HydratedEndBuilding | HydratedFinishBuilding

// R-3.2: phase 2, in turn order (R-2.2).
export class BuildingStateHandler implements MachineStateHandler<
    BuildingAction,
    HydratedRideTheRailsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedRideTheRailsGameState>
    ): action is BuildingAction {
        if (action instanceof HydratedPlaceLocomotive) {
            return action.verdict(context.gameState).legal
        }
        return isEndBuilding(action) || isFinishBuilding(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRideTheRailsGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.PlaceLocomotive, HydratedPlaceLocomotive.canPlace(state, playerId)],
            [ActionType.EndBuilding, HydratedEndBuilding.canEnd(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    // R-3.2.1, R-3.2.3, R-3.2.4: a building turn opens with no placement, and ends by itself
    // once nothing more is legal, as it opens or after a placement.
    enter(context: MachineContext<HydratedRideTheRailsGameState>) {
        const state = context.gameState
        const playerId = turnPlayerId(state)
        state.activePlayerIds = [playerId]
        state.building ??= { placed: 0, usedMountain: false }
        scheduleFinishBuilding(context, playerId)
    }

    onAction(
        action: BuildingAction,
        context: MachineContext<HydratedRideTheRailsGameState>
    ): MachineState {
        const state = context.gameState
        if (action instanceof HydratedPlaceLocomotive) {
            return MachineState.Building
        }
        if (passTurn(state, PhaseName.Build)) {
            return MachineState.Building
        }
        endPhase(state)
        startPhase(state, PhaseName.Ride)
        return MachineState.Riding
    }
}
