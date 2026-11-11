import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedPlaceSealedBid, isPlaceSealedBid } from '../actions/placeSealedBid.js'
import { ResolveIndustryAuction } from '../actions/resolveIndustryAuction.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'

export class SealedBiddingStateHandler implements MachineStateHandler<
    HydratedPlaceSealedBid,
    HydratedRailheadsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedRailheadsGameState>
    ): action is HydratedPlaceSealedBid {
        return (
            isPlaceSealedBid(action) &&
            HydratedPlaceSealedBid.canBid(context.gameState, action.playerId)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRailheadsGameState>
    ): ActionType[] {
        return HydratedPlaceSealedBid.canBid(context.gameState, playerId)
            ? [ActionType.PlaceSealedBid]
            : []
    }

    enter(context: MachineContext<HydratedRailheadsGameState>) {
        context.gameState.activePlayerIds = [...context.gameState.awaitedBidders()]
    }

    onAction(
        _action: HydratedPlaceSealedBid,
        context: MachineContext<HydratedRailheadsGameState>
    ): MachineState {
        if (context.gameState.awaitedBidders().length > 0) {
            return MachineState.SealedBidding
        }
        context.addSystemAction(ResolveIndustryAuction, { revealsInfo: true })
        return MachineState.ResolvingIndustryAuction
    }
}
