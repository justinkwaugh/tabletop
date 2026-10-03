import {
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import {
    SelectionAuctionModel,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from './selectionAuction.js'
import type { StockState } from '../stock/stockState.js'
import { HydratedNominateLot } from './nominateLot.js'
import { HydratedBidForLot } from './bidForLot.js'
import { HydratedPassSelectionAuction } from './passSelectionAuction.js'
import {
    HydratedResolveSelectionAuction,
    ResolveSelectionAuction
} from './resolveSelectionAuction.js'

export class SelectionAuctionHandler<
    State extends HydratedGameState & SelectionAuctionState & StockState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly rules: SelectionAuctionRules) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        return (
            (action instanceof HydratedNominateLot ||
                action instanceof HydratedBidForLot ||
                action instanceof HydratedPassSelectionAuction ||
                action instanceof HydratedResolveSelectionAuction) &&
            action.isValid(context.gameState)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const model = new SelectionAuctionModel(state, this.rules)
        if (
            model.auction.completed ||
            !state.activePlayerIds.includes(playerId) ||
            model.playerId !== playerId ||
            model.resolution()
        )
            return []
        const bidding = model.auction.bidding
        if (bidding)
            return [
                'PassSelectionAuction',
                ...(model.canBid(playerId, bidding.lotId, model.minimumBid(bidding.lotId))
                    ? ['BidForLot']
                    : [])
            ]
        return [
            ...(model.canPass(playerId) ? ['PassSelectionAuction'] : []),
            ...(model.rules.nominationLotIds(state).some((lotId) =>
                model.canNominate(playerId, lotId, model.minimumBid(lotId))
            )
                ? ['NominateLot']
                : [])
        ]
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        const model = new SelectionAuctionModel(state, this.rules)
        if (model.resolution()) {
            context.addSystemAction(ResolveSelectionAuction, {})
            return
        }
        const playerId = model.playerId
        if (!playerId) return
        state.activePlayerIds = [playerId]
        if (state.turnManager.currentTurn()?.playerId !== playerId) {
            state.turnManager.endTurn(state.actionCount)
            state.turnManager.startTurn(playerId, state.actionCount + 1)
        }
    }
    onAction(_action: HydratedAction, context: MachineContext<State>): string {
        return context.gameState.selectionAuction?.completed ? 'StockRound' : 'SelectionAuction'
    }
}
