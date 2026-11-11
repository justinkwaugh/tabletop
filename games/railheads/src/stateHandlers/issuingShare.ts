import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedIssueShare, isIssueShare } from '../actions/issueShare.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { afterSale } from './flow.js'

export class IssuingShareStateHandler implements MachineStateHandler<
    HydratedIssueShare,
    HydratedRailheadsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRailheadsGameState>
    ): action is HydratedIssueShare {
        return isIssueShare(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRailheadsGameState>
    ): ActionType[] {
        return HydratedIssueShare.canIssue(context.gameState, playerId)
            ? [ActionType.IssueShare]
            : []
    }

    enter(context: MachineContext<HydratedRailheadsGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    onAction(
        action: HydratedIssueShare,
        context: MachineContext<HydratedRailheadsGameState>
    ): MachineState {
        const sale = action.metadata?.sale
        return sale ? afterSale(context.gameState, sale) : MachineState.ShareBidding
    }
}
