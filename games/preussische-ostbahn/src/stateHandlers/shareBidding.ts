import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { AwardShare, HydratedAwardShare, isAwardShare } from '../actions/awardShare.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { afterSale } from './flow.js'

type BiddingAction = HydratedPlaceBid | HydratedPassBid | HydratedAwardShare

export class ShareBiddingStateHandler implements MachineStateHandler<
    BiddingAction,
    HydratedOstbahnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOstbahnGameState>
    ): action is BiddingAction {
        return isPlaceBid(action) || isPassBid(action) || isAwardShare(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOstbahnGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.PlaceBid, HydratedPlaceBid.canBid(state, playerId)],
            [ActionType.PassBid, HydratedPassBid.canPass(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedOstbahnGameState>) {
        const bidderId = context.gameState.bidding().currentBidderId
        if (bidderId === undefined) {
            context.gameState.activePlayerIds = []
            context.addSystemAction(AwardShare, {})
            return
        }
        context.gameState.activePlayerIds = [bidderId]
    }

    onAction(
        action: BiddingAction,
        context: MachineContext<HydratedOstbahnGameState>
    ): MachineState {
        const sale = action.metadata?.sale
        return sale ? afterSale(context.gameState, sale) : MachineState.ShareBidding
    }
}
