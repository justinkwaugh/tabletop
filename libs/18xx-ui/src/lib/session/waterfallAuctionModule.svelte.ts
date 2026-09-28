import { assert, assertExists } from '@tabletop/common'
import {
    BuyAuctionLot,
    PassAuction,
    RaiseAuctionBid,
    ReserveBid,
    ReserveBidAuction,
    type AuctionState,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import type { AuctionSelection } from '../auctions/auctionSelection.js'
import type { ModuleSession } from './moduleSession.js'
import { singleChoice } from './stagedSelection.svelte.js'

export type WaterfallAuctionSession = ModuleSession<
    AuctionState,
    Pick<EighteenXXTitleRules, 'auctionRules'>
>

export class WaterfallAuctionModule {
    readonly choice = singleChoice<AuctionSelection>()
    constructor(private readonly session: WaterfallAuctionSession) {}

    model = $derived.by(() =>
        this.session.state.openingAuction && this.session.rules.auctionRules
            ? new ReserveBidAuction(this.session.state, this.session.rules.auctionRules)
            : undefined
    )
    selection = $derived.by(() =>
        !this.session.selectionsVisible || this.model?.auction.completed
            ? undefined
            : this.choice.value('choice')
    )
    canAct = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('PassAuction')
    )
    remainingLots = $derived.by(() => {
        const model = this.model
        if (!model || model.auction.completed) return []
        const commitments = model.commitments()
        return model.auction.remainingLotIds.map((lotId) => {
            const lot = model.lots.find((item) => item.id === lotId)
            assertExists(lot, 'Remaining auction lot must be known')
            return {
                lot,
                bids: commitments
                    .filter((bid) => bid.lotId === lotId)
                    .sort((a, b) => b.amount - a.amount)
            }
        })
    })

    playerBids(playerId: string) {
        return this.remainingLots.flatMap(({ lot, bids }) =>
            bids
                .filter((bid) => bid.playerId === playerId)
                .map((bid) => ({ lot, amount: bid.amount }))
        )
    }

    selectLot(kind: AuctionSelection['kind'], lotId: string) {
        assert(this.canAct && this.model, 'Auction selection is unavailable')
        this.choice.choose('choice', {
            kind,
            lotId,
            amount: kind === 'buy' ? this.model.price(lotId) : this.model.minimumBid(lotId)
        })
    }
    setBid(amount: number) {
        const bid = this.choice.value('choice')
        assert(this.canAct && bid?.kind === 'bid', 'Select a bid first')
        this.choice.choose('choice', { ...bid, amount })
    }
    async buy(lotId: string) {
        assert(this.canAct && this.model, 'Auction purchase is unavailable')
        this.choice.clear()
        await this.session.applyAction(
            this.session.createPlayerAction(BuyAuctionLot, {
                lotId,
                expectedPrice: this.model.price(lotId)
            })
        )
    }
    async confirm() {
        const selection = this.selection
        assert(this.canAct && selection && this.model, 'Select an auction purchase or bid')
        if (selection.kind === 'buy')
            await this.session.applyAction(
                this.session.createPlayerAction(BuyAuctionLot, {
                    lotId: selection.lotId,
                    expectedPrice: selection.amount
                })
            )
        else
            await this.session.applyAction(
                this.session.createPlayerAction(
                    this.model.auction.bidding ? RaiseAuctionBid : ReserveBid,
                    { lotId: selection.lotId, amount: selection.amount }
                )
            )
    }
    async pass() {
        assert(this.canAct && !this.selection, 'Finish the auction selection first')
        await this.session.applyAction(this.session.createPlayerAction(PassAuction, {}))
    }
}
