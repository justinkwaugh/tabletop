import { assert } from '@tabletop/common'
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
import type { SessionContext } from './sessionContext.js'
import { singleChoice } from './stagedSelection.svelte.js'

export type WaterfallAuctionContext = SessionContext<
    AuctionState,
    Pick<EighteenXXTitleRules, 'auctionRules'>
>

export class WaterfallAuctionModule {
    readonly choice = singleChoice<AuctionSelection>()
    constructor(private readonly context: WaterfallAuctionContext) {}

    model = $derived.by(() =>
        this.context.state.openingAuction && this.context.rules.auctionRules
            ? new ReserveBidAuction(this.context.state, this.context.rules.auctionRules)
            : undefined
    )
    selection = $derived.by(() =>
        !this.context.selectionsVisible || this.model?.auction.completed
            ? undefined
            : this.choice.value('choice')
    )
    canAct = $derived.by(
        () => this.context.interactive && this.context.validActionTypes.includes('PassAuction')
    )

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
    async confirm() {
        const draft = this.selection
        assert(this.canAct && draft && this.model, 'Select an auction purchase or bid')
        if (draft.kind === 'buy')
            await this.context.applyAction(
                this.context.createPlayerAction(BuyAuctionLot, {
                    lotId: draft.lotId,
                    expectedPrice: draft.amount
                })
            )
        else
            await this.context.applyAction(
                this.context.createPlayerAction(
                    this.model.auction.bidding ? RaiseAuctionBid : ReserveBid,
                    { lotId: draft.lotId, amount: draft.amount }
                )
            )
    }
    async pass() {
        assert(this.canAct && !this.selection, 'Finish the auction selection first')
        await this.context.applyAction(this.context.createPlayerAction(PassAuction, {}))
    }
}
