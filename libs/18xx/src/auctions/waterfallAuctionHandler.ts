import type {
    HydratedAction,
    HydratedGameState,
    MachineContext,
    MachineStateHandler
} from '@tabletop/common'
import {
    ReserveBidAuction,
    type AuctionState,
    type WaterfallAuctionRules
} from './waterfallAuction.js'
import type { StockState } from '../stock/stockState.js'
import { HydratedReserveBid } from './reserveBid.js'
import { HydratedRaiseAuctionBid } from './raiseAuctionBid.js'
import { HydratedBuyAuctionLot } from './buyAuctionLot.js'
import { HydratedPassAuction } from './passAuction.js'
import { HydratedResolveAuction, ResolveAuction } from './resolveAuction.js'
export class WaterfallAuctionHandler<
    State extends HydratedGameState & AuctionState & StockState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly rules: WaterfallAuctionRules) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        return (
            (action instanceof HydratedReserveBid ||
                action instanceof HydratedRaiseAuctionBid ||
                action instanceof HydratedBuyAuctionLot ||
                action instanceof HydratedPassAuction ||
                action instanceof HydratedResolveAuction) &&
            action.isValid(context.gameState)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const model = new ReserveBidAuction(state, this.rules)
        if (
            model.auction.completed ||
            !state.activePlayerIds.includes(playerId) ||
            model.playerId !== playerId ||
            model.resolution()
        )
            return []
        const buyOnly = model.buyOnlyLotIds()
        const ids = model.auction.bidding
            ? [model.auction.bidding.lotId]
            : model.auction.remainingLotIds.filter((lotId) => !buyOnly.includes(lotId))
        return [
            'PassAuction',
            ...(buyOnly.some((lotId) => model.canPurchase(playerId, lotId))
                ? ['BuyAuctionLot']
                : []),
            ...(ids.some((id) => model.canBid(playerId, id, model.minimumBid(id)))
                ? [model.auction.bidding ? 'RaiseAuctionBid' : 'ReserveBid']
                : [])
        ]
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        const model = new ReserveBidAuction(state, this.rules)
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
    onAction(_action: HydratedAction, context: MachineContext<State>): string {
        // An export after an all-pass income round may start a phase, which resumes the auction.
        const state: object = context.gameState
        if ('phaseChange' in state && state.phaseChange) return 'AdvancingPhase'
        return context.gameState.openingAuction?.completed
            ? 'StockRound'
            : context.gameState.openingAuction?.bidding
              ? 'AuctionBidding'
              : 'WaterfallAuction'
    }
}
