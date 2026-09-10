import {
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import {
    OfferAuction,
    type OfferAuctionState,
    type OfferPileAuctionRules
} from './offerPileAuction.js'
import { HydratedOfferAuctionLot } from './offerAuctionLot.js'
import { HydratedBidOnAuctionLot } from './bidOnAuctionLot.js'
import { HydratedPassAuction } from './passAuction.js'
import { HydratedResolveAuction, ResolveAuction } from './resolveAuction.js'
export class OfferAuctionHandler<
    State extends HydratedGameState & OfferAuctionState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly rules: OfferPileAuctionRules) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>) {
        return (
            (action instanceof HydratedOfferAuctionLot ||
                action instanceof HydratedBidOnAuctionLot ||
                action instanceof HydratedPassAuction ||
                action instanceof HydratedResolveAuction) &&
            action.isValid(context.gameState)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>) {
        const model = new OfferAuction(context.gameState, this.rules)
        if (
            model.auction.completed ||
            model.auction.stalled ||
            !context.gameState.activePlayerIds.includes(playerId) ||
            model.playerId !== playerId ||
            model.resolution()
        )
            return []
        if (!model.auction.bidding) return ['OfferAuctionLot']
        return [
            'PassAuction',
            ...(model.canBid(playerId, model.auction.bidding.lotId, model.minimumBid)
                ? ['BidOnAuctionLot']
                : [])
        ]
    }
    enter(context: MachineContext<State>) {
        const state = context.gameState,
            model = new OfferAuction(state, this.rules)
        if (model.auction.stalled) {
            state.activePlayerIds = []
            return
        }
        if (model.resolution()) {
            context.addSystemAction(ResolveAuction, {})
            return
        }
        state.activePlayerIds = [model.playerId]
        if (state.turnManager.currentTurn()?.playerId !== model.playerId) {
            state.turnManager.endTurn(state.actionCount)
            state.turnManager.startTurn(model.playerId, state.actionCount + 1)
        }
    }
    onAction(_action: HydratedAction, context: MachineContext<State>) {
        const auction = context.gameState.offerAuction!
        return auction.completed ? 'StockRound' : auction.bidding ? 'OfferBidding' : 'OfferingLot'
    }
}
