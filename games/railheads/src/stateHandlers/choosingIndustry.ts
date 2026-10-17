import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedInvestInIndustry, isInvestInIndustry } from '../actions/investInIndustry.js'
import { ResolveIndustryAuction } from '../actions/resolveIndustryAuction.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'

export class ChoosingIndustryStateHandler implements MachineStateHandler<
    HydratedInvestInIndustry,
    HydratedRailheadsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRailheadsGameState>
    ): action is HydratedInvestInIndustry {
        return isInvestInIndustry(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRailheadsGameState>
    ): ActionType[] {
        return HydratedInvestInIndustry.canInvest(context.gameState, playerId)
            ? [ActionType.InvestInIndustry]
            : []
    }

    enter(context: MachineContext<HydratedRailheadsGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    onAction(
        _action: HydratedInvestInIndustry,
        context: MachineContext<HydratedRailheadsGameState>
    ): MachineState {
        if (context.gameState.awaitedBidders().length > 0) {
            return MachineState.SealedBidding
        }
        context.addSystemAction(ResolveIndustryAuction, {})
        return MachineState.ResolvingIndustryAuction
    }
}
