import * as Type from 'typebox'
import {
    assert,
    assertExists,
    availableBidAmount,
    BidCommitment,
    SimpleAuction,
    HydratedSimpleAuction,
    AuctionType,
    type GameState
} from '@tabletop/common'
import { cashOwnedBy, type FinancialState } from '../finance/finance.js'

export const AuctionLot = Type.Object(
    { id: Type.String(), name: Type.String(), price: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type AuctionLot = Type.Static<typeof AuctionLot>
export const AuctionAward = Type.Object(
    { lotId: Type.String(), playerId: Type.String(), price: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type AuctionAward = Type.Static<typeof AuctionAward>
export const WaterfallAuction = Type.Object(
    {
        remainingLotIds: Type.Array(Type.String()),
        reservations: Type.Array(BidCommitment),
        nextPlayerId: Type.String(),
        passedPlayerIds: Type.Array(Type.String()),
        discount: Type.Integer({ minimum: 0 }),
        awards: Type.Array(AuctionAward),
        bidding: Type.Optional(
            Type.Object(
                { lotId: Type.String(), auction: SimpleAuction, playerId: Type.String() },
                { additionalProperties: false }
            )
        ),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type WaterfallAuction = Type.Static<typeof WaterfallAuction>
export const AuctionFields = { openingAuction: Type.Optional(WaterfallAuction) }
export type AuctionState = FinancialState &
    Pick<GameState, 'players' | 'activePlayerIds' | 'turnManager'> &
    Type.Static<Type.TObject<typeof AuctionFields>>
export interface WaterfallAuctionRules {
    lots(state: FinancialState): readonly AuctionLot[]
    increment: number
    bidOrder: 'clockwise-from-highest' | 'lowest-bid-first'
    award(state: AuctionState, award: AuctionAward): void
    payIncome(state: AuctionState): void
}
export type AuctionResolution =
    | { kind: 'award'; award: AuctionAward }
    | { kind: 'open-bidding'; lotId: string }
    | { kind: 'discount' }
    | { kind: 'income' }
    | { kind: 'complete' }
export class ReserveBidAuction {
    constructor(
        private readonly state: AuctionState,
        readonly rules: WaterfallAuctionRules
    ) {}
    get auction(): WaterfallAuction {
        assertExists(this.state.openingAuction, 'The opening auction is missing')
        return this.state.openingAuction
    }
    get lots(): readonly AuctionLot[] {
        return this.rules.lots(this.state)
    }
    get playerId(): string {
        return this.auction.bidding?.playerId ?? this.auction.nextPlayerId
    }
    commitments(): BidCommitment[] {
        const bidding = this.auction.bidding
        return [
            ...this.auction.reservations,
            ...(bidding
                ? bidding.auction.participants.flatMap((participant) =>
                      !participant.passed && participant.bid !== undefined
                          ? [
                                {
                                    lotId: bidding.lotId,
                                    playerId: participant.playerId,
                                    amount: participant.bid
                                }
                            ]
                          : []
                  )
                : [])
        ]
    }
    availableCash(playerId: string, lotId?: string): number {
        const cash = cashOwnedBy(this.state, { kind: 'player', playerId })
        assert(typeof cash === 'number', 'Auction bidders require finite cash')
        return availableBidAmount(cash, this.commitments(), playerId, lotId)
    }
    price(lotId: string): number {
        const lot = this.lots.find((lot) => lot.id === lotId)
        assertExists(lot, 'Unknown auction lot')
        return lot.price - (lotId === this.lots[0].id ? this.auction.discount : 0)
    }
    minimumBid(lotId: string): number {
        return (
            Math.max(
                this.price(lotId),
                ...this.commitments()
                    .filter((bid) => bid.lotId === lotId)
                    .map((bid) => bid.amount)
            ) + this.rules.increment
        )
    }
    canPurchase(playerId: string, lotId: string): boolean {
        return (
            !this.auction.completed &&
            !this.auction.bidding &&
            !this.resolution() &&
            playerId === this.playerId &&
            this.auction.remainingLotIds[0] === lotId &&
            this.availableCash(playerId) >= this.price(lotId)
        )
    }
    canBid(playerId: string, lotId: string, amount: number): boolean {
        if (
            this.auction.completed ||
            this.resolution() ||
            playerId !== this.playerId ||
            !Number.isSafeInteger(amount)
        )
            return false
        const bidding = this.auction.bidding
        if (
            bidding
                ? bidding.lotId !== lotId ||
                  !bidding.auction.participants.some((p) => p.playerId === playerId && !p.passed)
                : !this.auction.remainingLotIds.slice(1).includes(lotId)
        )
            return false
        return amount >= this.minimumBid(lotId) && amount <= this.availableCash(playerId, lotId)
    }
    bid(playerId: string, lotId: string, amount: number): void {
        assert(this.canBid(playerId, lotId, amount), 'Invalid auction bid')
        const bidding = this.auction.bidding
        if (bidding) {
            const auction = new HydratedSimpleAuction(bidding.auction)
            auction.placeBid(playerId, amount)
            auction.highBid = amount
            bidding.auction = auction.dehydrate()
            bidding.playerId = this.nextBidder(playerId)
        } else {
            this.auction.reservations = this.auction.reservations.filter(
                (bid) => bid.playerId !== playerId || bid.lotId !== lotId
            )
            this.auction.reservations.push({ playerId, lotId, amount })
            this.advanceOuterTurn()
        }
    }
    pass(): void {
        const bidding = this.auction.bidding
        if (bidding) {
            const auction = new HydratedSimpleAuction(bidding.auction)
            auction.pass(bidding.playerId)
            bidding.auction = auction.dehydrate()
            if (auction.participants.filter((p) => !p.passed).length > 1)
                bidding.playerId = this.nextBidder(bidding.playerId)
        } else {
            this.auction.passedPlayerIds.push(this.auction.nextPlayerId)
            this.auction.nextPlayerId = this.nextPlayer(this.auction.nextPlayerId)
        }
    }
    purchase(playerId: string, lotId: string): AuctionAward {
        assert(this.canPurchase(playerId, lotId), 'Invalid auction purchase')
        const award = { playerId, lotId, price: this.price(lotId) }
        this.award(award)
        this.advanceOuterTurn()
        return award
    }
    resolution(): AuctionResolution | undefined {
        if (this.auction.completed) return undefined
        if (!this.auction.remainingLotIds.length) return { kind: 'complete' }
        const bidding = this.auction.bidding
        if (bidding) {
            const remaining = bidding.auction.participants.filter((p) => !p.passed)
            if (remaining.length === 1) {
                const winner = remaining[0]
                assertExists(winner.bid, 'Auction winner requires a bid')
                return {
                    kind: 'award',
                    award: { lotId: bidding.lotId, playerId: winner.playerId, price: winner.bid }
                }
            }
            return undefined
        }
        const lotId = this.auction.remainingLotIds[0]
        const bids = this.auction.reservations.filter((bid) => bid.lotId === lotId)
        if (bids.length === 1)
            return {
                kind: 'award',
                award: { lotId, playerId: bids[0].playerId, price: bids[0].amount }
            }
        if (bids.length > 1) return { kind: 'open-bidding', lotId }
        if (this.auction.passedPlayerIds.length === this.state.players.length)
            return { kind: this.auction.awards.length ? 'income' : 'discount' }
        return undefined
    }
    resolve(actionId: string): AuctionResolution {
        const result = this.resolution()
        assertExists(result, 'No auction consequence is pending')
        switch (result.kind) {
            case 'award':
                this.award(result.award)
                break
            case 'open-bidding': {
                const bids = this.auction.reservations.filter((bid) => bid.lotId === result.lotId)
                const highest = bids.reduce((high, bid) => (bid.amount > high.amount ? bid : high))
                this.auction.bidding = {
                    lotId: result.lotId,
                    playerId: highest.playerId,
                    auction: {
                        id: actionId,
                        type: AuctionType.Simple,
                        highBid: highest.amount,
                        participants: bids.map((bid) => ({
                            playerId: bid.playerId,
                            bid: bid.amount,
                            passed: false
                        }))
                    }
                }
                this.auction.reservations = this.auction.reservations.filter(
                    (bid) => bid.lotId !== result.lotId
                )
                this.auction.bidding.playerId = this.nextBidder(highest.playerId)
                break
            }
            case 'discount': {
                this.auction.discount = Math.min(
                    this.lots[0].price,
                    this.auction.discount + this.rules.increment
                )
                this.auction.passedPlayerIds = []
                if (this.price(this.lots[0].id) === 0) {
                    this.award({
                        lotId: this.lots[0].id,
                        playerId: this.auction.nextPlayerId,
                        price: 0
                    })
                    this.advanceOuterTurn()
                }
                break
            }
            case 'income':
                this.rules.payIncome(this.state)
                this.auction.passedPlayerIds = []
                break
            case 'complete':
                this.auction.completed = true
                break
        }
        return result
    }
    private award(award: AuctionAward): void {
        this.rules.award(this.state, award)
        this.auction.awards.push(award)
        this.auction.remainingLotIds.shift()
        this.auction.reservations = this.auction.reservations.filter(
            (bid) => bid.lotId !== award.lotId
        )
        delete this.auction.bidding
    }
    private advanceOuterTurn(): void {
        this.auction.nextPlayerId = this.nextPlayer(this.auction.nextPlayerId)
        this.auction.passedPlayerIds = []
    }
    private nextPlayer(playerId: string, eligible?: string[]): string {
        const order = this.state.turnManager.turnOrder
        const start = order.indexOf(playerId)
        assert(start >= 0, 'Unknown auction player')
        for (let offset = 1; offset <= order.length; offset++) {
            const id = order[(start + offset) % order.length]
            if (!eligible || eligible.includes(id)) return id
        }
        throw Error('Auction has no eligible next bidder')
    }
    private nextBidder(playerId: string): string {
        const participants = this.auction.bidding!.auction.participants.filter((p) => !p.passed)
        if (this.rules.bidOrder === 'lowest-bid-first')
            return participants.reduce((low, p) => ((p.bid ?? 0) < (low.bid ?? 0) ? p : low))
                .playerId
        return this.nextPlayer(
            playerId,
            participants.map((p) => p.playerId)
        )
    }
}

export function validateWaterfallAuction(state: {
    machineState: string
    openingAuction?: WaterfallAuction
    players: readonly { playerId: string }[]
    companies: readonly { id: string }[]
}): void {
    const auction = state.openingAuction
    if (!auction) return
    assert(
        auction.completed !== ['WaterfallAuction', 'AuctionBidding'].includes(state.machineState),
        'Opening auction progress must match its state'
    )
    assert(
        state.players.some((player) => player.playerId === auction.nextPlayerId),
        'Unknown outer auction player'
    )
    assert(
        new Set(auction.remainingLotIds).size === auction.remainingLotIds.length,
        'Duplicate auction lot'
    )
    assert(
        auction.remainingLotIds.every((id) => state.companies.some((company) => company.id === id)),
        'Unknown auction lot'
    )
    assert(
        new Set(auction.reservations.map((bid) => `${bid.playerId}:${bid.lotId}`)).size ===
            auction.reservations.length,
        'Duplicate bid commitment'
    )
    assert(
        auction.reservations.every(
            (bid) =>
                auction.remainingLotIds.includes(bid.lotId) &&
                state.players.some((player) => player.playerId === bid.playerId)
        ),
        'Invalid reservation'
    )
}
