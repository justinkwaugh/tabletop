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
    active = $derived.by(() => !!this.model && !this.model.auction.completed)
    ownTurn = $derived.by(() => this.session.validActionTypes.includes('PassAuction'))
    selection = $derived.by(() =>
        !this.session.selectionsVisible || !this.active || !this.ownTurn
            ? undefined
            : this.choice.value('choice')
    )
    canAct = $derived.by(() => this.session.interactive && this.ownTurn)
    lots = $derived.by(() => {
        const model = this.model
        if (!model || model.auction.completed) return []
        const commitments = model.commitments()
        return model.lots.map((lot) => ({
            lot,
            award: model.auction.awards.find((award) => award.lotId === lot.id),
            bids: commitments
                .filter((bid) => bid.lotId === lot.id)
                .sort((a, b) => b.amount - a.amount)
        }))
    })
    remainingLots = $derived.by(() => {
        const model = this.model
        if (!model || model.auction.completed) return []
        return model.auction.remainingLotIds.map((lotId) => {
            const entry = this.lots.find(({ lot }) => lot.id === lotId)
            assertExists(entry, 'Remaining auction lot must be known')
            return entry
        })
    })
    openLotId = $derived(this.model?.auction.remainingLotIds[0])
    contest = $derived.by(() => {
        const bidding = this.model?.auction.bidding
        if (!bidding) return undefined
        const highBid = bidding.auction.highBid
        assertExists(highBid, 'Contested lots open with a reserved high bid')
        const leader = bidding.auction.participants.find(
            (participant) => !participant.passed && participant.bid === highBid
        )
        assertExists(leader, 'High bid requires a bidder')
        return { lotId: bidding.lotId, highBid, highBidderId: leader.playerId }
    })
    raiseAmount = $derived.by(() => {
        const contest = this.contest
        if (!contest || !this.model) return undefined
        return this.selection?.amount ?? this.model.minimumBid(contest.lotId)
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
    setRaise(amount: number) {
        const contest = this.contest
        assert(this.canAct && contest, 'No private is being contested')
        if (!this.selection) this.selectLot('bid', contest.lotId)
        this.setBid(amount)
    }
    async raise() {
        const amount = this.raiseAmount
        assert(amount !== undefined, 'No private is being contested')
        this.setRaise(amount)
        await this.confirm()
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
        assert(this.canAct, 'Passing is unavailable')
        this.choice.clear()
        await this.session.applyAction(this.session.createPlayerAction(PassAuction, {}))
    }
}
