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
import type { SessionContext } from './sessionContext.js'
import type { SessionDraft } from './sessionDrafts.js'

export type OfferAuctionContext = SessionContext<
    OfferAuctionState,
    Pick<EighteenXXTitleRules, 'offerAuctionRules'>
>

export class OfferAuctionModule implements SessionDraft {
    #draft: OfferAuctionSelection | undefined = $state()
    constructor(private readonly context: OfferAuctionContext) {}

    model = $derived.by(() =>
        this.context.state.offerAuction && this.context.rules.offerAuctionRules
            ? new OfferAuction(this.context.state, this.context.rules.offerAuctionRules)
            : undefined
    )
    selection = $derived.by(() =>
        !this.context.draftsVisible || this.model?.auction.completed ? undefined : this.#draft
    )
    canAct = $derived.by(
        () =>
            this.context.interactive &&
            (this.context.validActionTypes.includes('OfferAuctionLot') ||
                this.context.validActionTypes.includes('PassAuction'))
    )

    select(lotId: string) {
        assert(this.canAct && this.model, 'Auction selection is unavailable')
        this.#draft = {
            lotId,
            ...(this.model.auction.bidding ? { amount: this.model.minimumBid } : {})
        }
    }
    setBid(amount: number) {
        assert(this.#draft && this.canAct, 'Select a bid')
        this.#draft = { ...this.#draft, amount }
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
            await this.context.applyAction(
                this.context.createPlayerAction(BidOnAuctionLot, {
                    lotId: draft.lotId,
                    amount: draft.amount
                })
            )
        } else
            await this.context.applyAction(
                this.context.createPlayerAction(OfferAuctionLot, { lotId: draft.lotId })
            )
    }
    async pass() {
        assert(this.canAct && !this.selection, 'Finish the auction selection')
        await this.context.applyAction(this.context.createPlayerAction(PassAuction, {}))
    }

    pending() {
        return this.#draft !== undefined
    }
    unwind() {
        if (this.#draft === undefined) return false
        this.#draft = undefined
        return true
    }
    clear() {
        this.#draft = undefined
    }
}
