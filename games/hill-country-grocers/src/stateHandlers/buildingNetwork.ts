import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedBuildNetwork, isBuildNetwork } from '../actions/buildNetwork.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { finishTurnAction } from './flow.js'

export class BuildingNetworkStateHandler implements MachineStateHandler<
    HydratedBuildNetwork,
    HydratedHcgGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHcgGameState>
    ): action is HydratedBuildNetwork {
        return isBuildNetwork(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedHcgGameState>
    ): ActionType[] {
        const state = context.gameState
        return state.turnPlayerId() === playerId && HydratedBuildNetwork.canBuild(state, playerId)
            ? [ActionType.BuildNetwork]
            : []
    }

    enter(context: MachineContext<HydratedHcgGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    onAction(
        _action: HydratedBuildNetwork,
        context: MachineContext<HydratedHcgGameState>
    ): MachineState {
        return finishTurnAction(context.gameState)
    }
}
