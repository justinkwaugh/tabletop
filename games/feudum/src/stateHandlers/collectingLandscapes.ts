import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import {
    askNextSerf,
    isCollectLandscapes,
    serfAsked,
    type HydratedCollectLandscapes
} from '../actions/collectLandscapes.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { stateAfterLandscapes } from './replenishing.js'

/** R-4.3.4, R-4.12.3 One serf asked at a time, each in a turn of the turn manager's. */
export class CollectingLandscapesStateHandler implements MachineStateHandler<
    HydratedCollectLandscapes,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedCollectLandscapes {
        return isCollectLandscapes(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return serfAsked(context.gameState) === playerId ? [ActionType.CollectLandscapes] : []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const next = askNextSerf(context.gameState)
        context.gameState.activePlayerIds = next ? [next] : []
    }

    /** R-4.12.3 The next serf; after the last, the dawn goes on. */
    onAction(
        _action: HydratedCollectLandscapes,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return context.gameState.flow.landscapes
            ? MachineState.CollectingLandscapes
            : stateAfterLandscapes(context)
    }
}
