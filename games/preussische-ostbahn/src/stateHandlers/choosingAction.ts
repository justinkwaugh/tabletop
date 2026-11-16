import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedCapitalize, isCapitalize } from '../actions/capitalize.js'
import { HydratedBuildTrack, isBuildTrack } from '../actions/buildTrack.js'
import { HydratedPassTurn, isPassTurn } from '../actions/passTurn.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { afterSale, finishSlot } from './flow.js'

type TurnAction = HydratedCapitalize | HydratedBuildTrack | HydratedPassTurn

export class ChoosingActionStateHandler implements MachineStateHandler<
    TurnAction,
    HydratedOstbahnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOstbahnGameState>
    ): action is TurnAction {
        return isCapitalize(action) || isBuildTrack(action) || isPassTurn(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOstbahnGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.Capitalize, HydratedCapitalize.canCapitalize(state, playerId)],
            [ActionType.BuildTrack, HydratedBuildTrack.canBuild(state, playerId)],
            [ActionType.PassTurn, HydratedPassTurn.canPass(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedOstbahnGameState>) {
        const state = context.gameState
        const playerId = state.slotPlayerId()
        if (!state.turnManager.currentTurn()) {
            state.turnManager.startTurn(playerId, state.actionCount)
        }
        state.activePlayerIds = [playerId]
    }

    onAction(action: TurnAction, context: MachineContext<HydratedOstbahnGameState>): MachineState {
        const state = context.gameState
        switch (true) {
            case isCapitalize(action): {
                const sale = action.metadata?.sale
                return sale ? afterSale(state, sale) : MachineState.ShareBidding
            }
            case isBuildTrack(action):
                return MachineState.Expanding
            case isPassTurn(action):
                return finishSlot(state)
            default:
                throw Error('Invalid action type')
        }
    }
}
