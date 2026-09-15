import * as Type from 'typebox'
import {
    SimpleAuction,
    HydratedSimpleAuction,
    AuctionType,
    assert,
    assertExists
} from '@tabletop/common'
import { cashOwnedBy, type FinancialState } from '../finance/finance.js'
import type { StockState } from '../stock/stockState.js'
import { AuctionAward, type AuctionLot } from './waterfallAuction.js'
export const OfferPileAuction = Type.Object(
    {
        piles: Type.Array(
            Type.Object(
                {
                    playerId: Type.String(),
                    lotIds: Type.Array(Type.String(), { uniqueItems: true })
                },
                { additionalProperties: false }
            )
        ),
        auctioneerId: Type.String(),
        bidding: Type.Optional(
            Type.Object(
                {
                    lotId: Type.String(),
                    playerId: Type.String(),
                    firstPassed: Type.Boolean(),
                    auction: SimpleAuction
                },
                { additionalProperties: false }
            )
        ),
        awards: Type.Array(AuctionAward),
        incomePayments: Type.Integer({ minimum: 0 }),
        stalled: Type.Boolean(),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type OfferPileAuction = Type.Static<typeof OfferPileAuction>
export const OfferPileFields = { offerAuction: Type.Optional(OfferPileAuction) }
export type OfferAuctionState = StockState & Type.Static<Type.TObject<typeof OfferPileFields>>
export interface OfferPileAuctionRules {
    lots(state: FinancialState): readonly AuctionLot[]
    increment: number
    award(state: OfferAuctionState, award: AuctionAward): void
    payIncome(state: OfferAuctionState): void
    firstStockOrder(state: OfferAuctionState): string[]
}
export type OfferAuctionResolution =
    | { kind: 'award'; award: AuctionAward }
    | { kind: 'income' }
    | { kind: 'complete' }
export class OfferAuction {
    constructor(
        private readonly state: OfferAuctionState,
        readonly rules: OfferPileAuctionRules
    ) {}
    get auction() {
        assertExists(this.state.offerAuction, 'Offer auction is missing')
        return this.state.offerAuction
    }
    get lots() {
        return this.rules.lots(this.state)
    }
    get playerId() {
        return this.auction.bidding?.playerId ?? this.auction.auctioneerId
    }
    get offerIds() {
        return this.auction.piles.find((pile) => pile.playerId === this.auction.auctioneerId)!
            .lotIds
    }
    get bidders() {
        return [
            this.nextPlayer(this.auction.auctioneerId, 1),
            this.nextPlayer(this.auction.auctioneerId, 2)
        ]
    }
    get forcedBuyerId() {
        return this.nextPlayer(this.auction.auctioneerId, 3)
    }
    cash(playerId: string) {
        const cash = cashOwnedBy(this.state, { kind: 'player', playerId })
        assert(typeof cash === 'number', 'Bidders require finite cash')
        return cash
    }
    price(lotId: string) {
        const lot = this.lots.find((lot) => lot.id === lotId)
        assertExists(lot, 'Unknown auction lot')
        return lot.price
    }
    get minimumBid() {
        const bidding = this.auction.bidding
        assertExists(bidding, 'No lot is being auctioned')
        return (bidding.auction.highBid ?? this.price(bidding.lotId)) + this.rules.increment
    }
    canOffer(playerId: string, lotId: string) {
        return (
            !this.auction.completed &&
            !this.auction.bidding &&
            playerId === this.auction.auctioneerId &&
            this.offerIds.includes(lotId)
        )
    }
    canBid(playerId: string, lotId: string, amount: number) {
        return (
            !this.resolution() &&
            this.auction.bidding?.lotId === lotId &&
            playerId === this.playerId &&
            Number.isSafeInteger(amount) &&
            amount % this.rules.increment === 0 &&
            amount >= this.minimumBid &&
            amount <= this.cash(playerId)
        )
    }
    get mustPass(): boolean {
        const bidding = this.auction.bidding
        return !!bidding && !this.resolution() &&
            !this.canBid(this.playerId, bidding.lotId, this.minimumBid)
    }
    offer(playerId: string, lotId: string, actionId: string) {
        assert(this.canOffer(playerId, lotId), 'Offer an item from your pile')
        this.auction.bidding = {
            lotId,
            playerId: this.bidders[0],
            firstPassed: false,
            auction: {
                id: actionId,
                type: AuctionType.Simple,
                participants: this.bidders.map((playerId) => ({ playerId, passed: false }))
            }
        }
    }
    bid(playerId: string, lotId: string, amount: number) {
        assert(this.canBid(playerId, lotId, amount), 'Invalid auction bid')
        const bidding = this.auction.bidding!
        const auction = new HydratedSimpleAuction(bidding.auction)
        auction.placeBid(playerId, amount)
        auction.highBid = amount
        bidding.auction = auction.dehydrate()
        bidding.playerId = this.bidders.find((id) => id !== playerId)!
    }
    pass() {
        const bidding = this.auction.bidding!
        const auction = new HydratedSimpleAuction(bidding.auction)
        if (auction.highBid === undefined && bidding.playerId === this.bidders[0]) {
            bidding.firstPassed = true
            bidding.playerId = this.bidders[1]
        } else {
            auction.pass(bidding.playerId)
            if (auction.highBid === undefined) auction.pass(this.bidders[0])
            bidding.auction = auction.dehydrate()
        }
    }
    resolution(): OfferAuctionResolution | undefined {
        if (this.auction.completed || this.auction.stalled) return undefined
        if (this.auction.piles.every((pile) => !pile.lotIds.length)) return { kind: 'complete' }
        const bidding = this.auction.bidding
        if (!bidding) return undefined
        const participants = bidding.auction.participants.filter((p) => !p.passed)
        if (participants.length === 1) {
            const winner = participants[0]
            assertExists(winner.bid, 'Winner requires a bid')
            return {
                kind: 'award',
                award: { lotId: bidding.lotId, playerId: winner.playerId, price: winner.bid }
            }
        }
        if (participants.length) return undefined
        const price = this.price(bidding.lotId)
        const order = this.state.turnManager.turnOrder.map((_, offset) =>
            this.nextPlayer(this.auction.auctioneerId, offset)
        )
        const richest = order.reduce((best, id) => (this.cash(id) > this.cash(best) ? id : best))
        const playerId =
            this.cash(this.forcedBuyerId) >= price && this.auction.incomePayments === 0
                ? this.forcedBuyerId
                : richest
        return this.cash(playerId) >= price
            ? { kind: 'award', award: { lotId: bidding.lotId, playerId, price } }
            : { kind: 'income' }
    }
    resolve(): OfferAuctionResolution {
        const resolution = this.resolution()
        assertExists(resolution, 'No auction consequence pending')
        if (resolution.kind === 'income') {
            const before = this.state.players.reduce((sum, p) => sum + this.cash(p.playerId), 0)
            this.rules.payIncome(this.state)
            this.auction.stalled =
                this.state.players.reduce((sum, p) => sum + this.cash(p.playerId), 0) === before
            this.auction.incomePayments++
        } else if (resolution.kind === 'award') {
            this.rules.award(this.state, resolution.award)
            this.auction.awards.push(resolution.award)
            const pile = this.auction.piles.find(
                (pile) => pile.playerId === this.auction.auctioneerId
            )!
            pile.lotIds = pile.lotIds.filter((id) => id !== resolution.award.lotId)
            this.auction.auctioneerId = this.nextPlayer(this.auction.auctioneerId, 1)
            delete this.auction.bidding
            this.auction.incomePayments = 0
        } else this.auction.completed = true
        return resolution
    }
    private nextPlayer(playerId: string, offset: number) {
        const order = this.state.turnManager.turnOrder
        return order[(order.indexOf(playerId) + offset) % order.length]
    }
}
