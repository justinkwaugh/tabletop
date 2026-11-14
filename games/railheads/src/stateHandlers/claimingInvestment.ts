import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedClaimInvestment, isClaimInvestment } from '../actions/claimInvestment.js'
import { HydratedDeclineInvestment, isDeclineInvestment } from '../actions/declineInvestment.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { currentClaimant } from '../model/industryAuctionRules.js'
import { finishTurn } from './flow.js'

type ClaimingInvestmentAction = HydratedClaimInvestment | HydratedDeclineInvestment

export class ClaimingInvestmentStateHandler implements MachineStateHandler<
    ClaimingInvestmentAction,
    HydratedRailheadsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedRailheadsGameState>
    ): action is ClaimingInvestmentAction {
        return (
            (isClaimInvestment(action) &&
                HydratedClaimInvestment.canClaim(context.gameState, action.playerId)) ||
            (isDeclineInvestment(action) &&
                HydratedDeclineInvestment.canDecline(context.gameState, action.playerId))
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRailheadsGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.ClaimInvestment, HydratedClaimInvestment.canClaim(state, playerId)],
            [ActionType.DeclineInvestment, HydratedDeclineInvestment.canDecline(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedRailheadsGameState>) {
        const claimant = currentClaimant(context.gameState)
        context.gameState.activePlayerIds = claimant ? [claimant.playerId] : []
    }

    onAction(
        _action: ClaimingInvestmentAction,
        context: MachineContext<HydratedRailheadsGameState>
    ): MachineState {
        return context.gameState.investmentClaim
            ? MachineState.ClaimingInvestment
            : finishTurn(context.gameState)
    }
}
