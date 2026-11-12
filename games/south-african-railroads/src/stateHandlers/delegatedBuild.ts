import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import {
    afterBuild,
    buildActionsFor,
    isBuildAction,
    type BuildAction
} from './constructingTrack.js'

export class DelegatedBuildStateHandler implements MachineStateHandler<
    BuildAction,
    HydratedSarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): action is BuildAction {
        return isBuildAction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSarGameState>
    ): ActionType[] {
        return buildActionsFor(context.gameState, playerId)
    }

    enter(context: MachineContext<HydratedSarGameState>) {
        const delegation = context.gameState.delegation
        context.gameState.activePlayerIds = delegation ? [delegation.builderId] : []
    }

    onAction(action: BuildAction, context: MachineContext<HydratedSarGameState>): MachineState {
        return afterBuild(action, context.gameState)
    }
}
