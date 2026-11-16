import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedBuildTrack, isBuildTrack } from '../actions/buildTrack.js'
import {
    CompleteExpansion,
    HydratedCompleteExpansion,
    HydratedEndExpansion,
    isCompleteExpansion,
    isEndExpansion
} from '../actions/endExpansion.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { finishSlot } from './flow.js'

type ExpansionAction = HydratedBuildTrack | HydratedEndExpansion | HydratedCompleteExpansion

export class ExpandingStateHandler implements MachineStateHandler<
    ExpansionAction,
    HydratedOstbahnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOstbahnGameState>
    ): action is ExpansionAction {
        return isBuildTrack(action) || isEndExpansion(action) || isCompleteExpansion(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOstbahnGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.BuildTrack, HydratedBuildTrack.canBuild(state, playerId)],
            [ActionType.EndExpansion, HydratedEndExpansion.canEnd(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedOstbahnGameState>) {
        const state = context.gameState
        const expansion = state.expansion
        assertExists(expansion, 'Expanding needs an Expansion in progress')
        if (state.buildChoices(expansion.railroadId).length === 0) {
            state.activePlayerIds = []
            context.addSystemAction(CompleteExpansion, {})
            return
        }
        state.activePlayerIds = [state.slotPlayerId()]
    }

    onAction(
        action: ExpansionAction,
        context: MachineContext<HydratedOstbahnGameState>
    ): MachineState {
        const state = context.gameState
        if (isBuildTrack(action)) {
            return MachineState.Expanding
        }
        return state.dividendRailroadId ? MachineState.PayingDividends : finishSlot(state)
    }
}
