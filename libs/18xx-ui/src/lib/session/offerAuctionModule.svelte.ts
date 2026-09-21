import { assert } from '@tabletop/common'
import {
    BidOnAuctionLot,
    OfferAuction,
    OfferAuctionLot,
    PassAuction,
    type EighteenXXTitleRules,
    type OfferAuctionState
} from '@tabletop/18xx'
import type { OfferAuctionSelection } from '../auctions/auctionSelection.js'
import type { ModuleSession } from './moduleSession.js'
import { singleChoice } from './stagedSelection.svelte.js'

export type OfferAuctionSession = ModuleSession<
    OfferAuctionState,
    Pick<EighteenXXTitleRules, 'offerAuctionRules'>
>

export class OfferAuctionModule {
    readonly choice = singleChoice<OfferAuctionSelection>()
    constructor(private readonly session: OfferAuctionSession) {}

    model = $derived.by(() =>
        this.session.state.offerAuction && this.session.rules.offerAuctionRules
            ? new OfferAuction(this.session.state, this.session.rules.offerAuctionRules)
            : undefined
    )
    selection = $derived.by(() =>
        !this.session.selectionsVisible || this.model?.auction.completed
            ? undefined
            : this.choice.value('choice')
    )
    canAct = $derived.by(
        () =>
            this.session.interactive &&
            (this.session.validActionTypes.includes('OfferAuctionLot') ||
                this.session.validActionTypes.includes('PassAuction'))
    )

    select(lotId: string) {
        assert(this.canAct && this.model, 'Auction selection is unavailable')
        this.choice.choose('choice', {
            lotId,
            ...(this.model.auction.bidding ? { amount: this.model.minimumBid } : {})
        })
    }
    setBid(amount: number) {
        const offer = this.choice.value('choice')
        assert(offer && this.canAct, 'Select a bid')
        this.choice.choose('choice', { ...offer, amount })
    }
    async offerLot(lotId: string) {
        this.select(lotId)
        await this.confirm()
    }
    async confirm() {
        const draft = this.selection
        assert(this.canAct && draft && this.model, 'Select an offer or bid')
        if (this.model.auction.bidding) {
            assert(draft.amount !== undefined, 'Enter a bid')
            await this.session.applyAction(
                this.session.createPlayerAction(BidOnAuctionLot, {
                    lotId: draft.lotId,
                    amount: draft.amount
                })
            )
        } else
            await this.session.applyAction(
                this.session.createPlayerAction(OfferAuctionLot, { lotId: draft.lotId })
            )
    }
    async pass() {
        assert(this.canAct && !this.selection, 'Finish the auction selection')
        await this.session.applyAction(this.session.createPlayerAction(PassAuction, {}))
    }
}
