import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedChooseAction, isChooseAction } from '../actions/chooseAction.js'
import { HydratedConsolidate, isConsolidate } from '../actions/consolidate.js'
import { ActionSpaceId } from '../editions/types.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { finishTurn, startNextTurn } from './flow.js'

type ChoosingActionAction = HydratedChooseAction | HydratedConsolidate

const NEXT_STATE: Record<ActionSpaceId, MachineState> = {
    [ActionSpaceId.IssueShare]: MachineState.IssuingShare,
    [ActionSpaceId.IndustryInvestment]: MachineState.ChoosingIndustry,
    [ActionSpaceId.LayTrackIII]: MachineState.LayingTrack,
    [ActionSpaceId.LayTrackII]: MachineState.LayingTrack,
    [ActionSpaceId.LayTrackI]: MachineState.LayingTrack
}

export class ChoosingActionStateHandler implements MachineStateHandler<
    ChoosingActionAction,
    HydratedRailheadsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRailheadsGameState>
    ): action is ChoosingActionAction {
        return isChooseAction(action) || isConsolidate(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRailheadsGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.ChooseAction, HydratedChooseAction.canChoose(state, playerId)],
            [ActionType.Consolidate, HydratedConsolidate.canConsolidate(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedRailheadsGameState>) {
        const state = context.gameState
        if (!state.turnManager.currentTurn()) {
            startNextTurn(state)
        }
        state.activePlayerIds = [state.turnPlayerId()]
    }

    onAction(
        action: ChoosingActionAction,
        context: MachineContext<HydratedRailheadsGameState>
    ): MachineState {
        return isConsolidate(action) ? finishTurn(context.gameState) : NEXT_STATE[action.space]
    }
}
