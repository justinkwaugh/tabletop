import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PhaseName, type HydratedPowerGridGameState } from '../model/gameState.js'
import { HydratedBuildCities, isBuildCities } from '../actions/buildCities.js'
import { enterTurnPhase } from './turnPhase.js'

type Context = MachineContext<HydratedPowerGridGameState>

/** Phase 4, in reverse player order; the game ends or Step 2 begins after it (Recharged pp. 5–8). */
export class BuildingStateHandler implements MachineStateHandler<
    HydratedBuildCities,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isBuildCities(action)
    }

    validActionsForPlayer(playerId: string, context: Context): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.BuildCities] : []
    }

    enter(context: Context) {
        const state = context.gameState
        enterTurnPhase(state, PhaseName.Building, state.reversedOrder())
    }

    onAction(_action: HydratedBuildCities, context: Context): MachineState {
        const state = context.gameState
        if (state.nextUndone(state.reversedOrder())) {
            return MachineState.Building
        }
        if (state.gameEndTriggered()) {
            return MachineState.EndOfGame
        }
        return state.step2Triggered() ? MachineState.StartingStep2 : MachineState.Powering
    }
}
