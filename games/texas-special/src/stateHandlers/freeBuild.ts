import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { BuildTrack, HydratedBuildTrack, isBuildTrack } from '../actions/buildTrack.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { homeLinks } from '../model/track.js'
import { afterFreeBuild } from './flow.js'

export class FreeBuildStateHandler implements MachineStateHandler<
    HydratedBuildTrack,
    HydratedSarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): action is HydratedBuildTrack {
        return isBuildTrack(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSarGameState>
    ): ActionType[] {
        return HydratedBuildTrack.canBuild(context.gameState, playerId)
            ? [ActionType.BuildTrack]
            : []
    }

    enter(context: MachineContext<HydratedSarGameState>) {
        const state = context.gameState
        const due = state.freeBuild
        state.activePlayerIds = due ? [due.playerId] : []
        if (!due) {
            return
        }
        const links = homeLinks(state, state.map.home(due.railroadId))
        if (links.length === 1) {
            context.addSystemAction(BuildTrack, {
                playerId: due.playerId,
                railroadId: due.railroadId,
                linkIds: links
            })
        }
    }

    onAction(
        action: HydratedBuildTrack,
        context: MachineContext<HydratedSarGameState>
    ): MachineState {
        return afterFreeBuild(context.gameState, action.railroadId, action.playerId)
    }
}
