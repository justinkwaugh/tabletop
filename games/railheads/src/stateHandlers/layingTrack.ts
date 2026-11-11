import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import { HydratedLayTrack, isLayTrack } from '../actions/layTrack.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { finishTurn } from './flow.js'

export class LayingTrackStateHandler implements MachineStateHandler<
    HydratedLayTrack,
    HydratedRailheadsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRailheadsGameState>
    ): action is HydratedLayTrack {
        return isLayTrack(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRailheadsGameState>
    ): ActionType[] {
        return HydratedLayTrack.canLay(context.gameState, playerId) ? [ActionType.LayTrack] : []
    }

    enter(context: MachineContext<HydratedRailheadsGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    onAction(
        _action: HydratedLayTrack,
        context: MachineContext<HydratedRailheadsGameState>
    ): MachineState {
        return finishTurn(context.gameState)
    }
}
