import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import {
    isReplenishGuilds,
    ReplenishGuilds,
    type HydratedReplenishGuilds
} from '../actions/replenishGuilds.js'
import { isReplenishMap, ReplenishMap, type HydratedReplenishMap } from '../actions/replenishMap.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { sunray } from '../model/tracks.js'
import { stateAtRoundEnd } from './endOfRound.js'

type ReplenishAction = HydratedReplenishMap | HydratedReplenishGuilds

/** R-4.12.4 The serfs are done: the map replenishes, except at V, whose ray prints no direction. */
export function stateAfterLandscapes(
    context: MachineContext<HydratedFeudumGameState>
): MachineState {
    if (sunray(context.gameState.epoch).mapDirection) {
        context.addSystemAction(ReplenishMap)
        return MachineState.Replenishing
    }
    return stateAtRoundEnd(context)
}

/** R-4.12.4, R-4.12.5 The map, then at III the guilds. The engine's alone. */
export class ReplenishingStateHandler implements MachineStateHandler<
    ReplenishAction,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is ReplenishAction {
        return isReplenishMap(action) || isReplenishGuilds(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        context.gameState.activePlayerIds = []
    }

    /** R-4.12.5 The ray's guild icon, once; R-2.2.5 then the round ends. */
    onAction(
        action: ReplenishAction,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        if (isReplenishMap(action) && sunray(context.gameState.epoch).guildRefill) {
            context.addSystemAction(ReplenishGuilds)
            return MachineState.Replenishing
        }
        return stateAtRoundEnd(context)
    }
}
