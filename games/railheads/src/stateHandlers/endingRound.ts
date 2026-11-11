import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { EndRound, HydratedEndRound, isEndRound } from '../actions/endRound.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'

export class EndingRoundStateHandler implements MachineStateHandler<
    HydratedEndRound,
    HydratedRailheadsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRailheadsGameState>
    ): action is HydratedEndRound {
        return isEndRound(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedRailheadsGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedRailheadsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(EndRound, {})
    }

    onAction(
        action: HydratedEndRound,
        _context: MachineContext<HydratedRailheadsGameState>
    ): MachineState {
        return action.metadata?.final ? MachineState.FinalScoring : MachineState.ChoosingAction
    }
}
