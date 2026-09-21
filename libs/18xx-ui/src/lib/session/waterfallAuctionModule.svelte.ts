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
            await this.session.applyAction(
                this.session.createPlayerAction(BuyAuctionLot, {
                    lotId: draft.lotId,
                    expectedPrice: draft.amount
                })
            )
        else
            await this.session.applyAction(
                this.session.createPlayerAction(
                    this.model.auction.bidding ? RaiseAuctionBid : ReserveBid,
                    { lotId: draft.lotId, amount: draft.amount }
                )
            )
    }
    async pass() {
        assert(this.canAct && !this.selection, 'Finish the auction selection first')
        await this.session.applyAction(this.session.createPlayerAction(PassAuction, {}))
    }
}
