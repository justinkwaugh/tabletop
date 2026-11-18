import {
    assert,
    assertExists,
    AuctionType,
    availableBidAmount,
    BidCommitment,
    HydratedSimpleAuction,
    SimpleAuction,
    type GameState
} from '@tabletop/common'
import * as Type from 'typebox'
import { PendingParFields } from '../company/pendingPar.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, type FinancialState } from '../finance/finance.js'

/** A row of lots of one printed price, and how far its sale has come. */
export type AuctionPriceRow = {
    price: number
    lotIds: string[]
    status: 'sold' | 'open' | 'later'
    remaining: number
    unbid: number
}

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
        completed: Type.Boolean(),
        /** The last player who bought a lot on their own turn, where it decides the priority. */
        lastPurchaserId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)
export type WaterfallAuction = Type.Static<typeof WaterfallAuction>
export const AuctionFields = {
    openingAuction: Type.Optional(WaterfallAuction)
}
export type AuctionState = FinancialState &
    Pick<GameState, 'players' | 'activePlayerIds' | 'turnManager'> &
    Type.Static<Type.TObject<typeof AuctionFields & typeof PendingParFields>>
/**
 * A title's waterfall auction. Its award and income hooks receive the title's whole state, such
 * as a share drawn at setup to go with a lot (1882 §3); the family's auction code reads only the
 * auction's own fields.
 */
export interface WaterfallAuctionRules<State extends AuctionState = AuctionState> {
    lots(state: FinancialState): readonly AuctionLot[]
    increment: number
    bidOrder: 'clockwise-from-highest' | 'lowest-bid-first'
    /** Bids must be multiples of this amount. */
    bidMultiple?: number
    /** A lot's first bid may equal its price; later bids beat the highest by the increment. */
    firstBidAtPrice?: true
    /**
     * When every player passes: the first lot's price falls until a lot is sold and income is
     * paid after (the default); pending bids resolve in lot order and then income is paid; or,
     * with ``discount-and-income``, the first lot's price falls while it is unsold and income is
     * paid whenever any lot has been sold; or, with ``discount-next``, the cheapest unsold lot's
     * price falls, its discount ending once it is bought, and no income is paid (1882 §9).
     */
    allPass?:
        'discount-or-income' | 'resolve-bids-then-income' | 'discount-and-income' | 'discount-next'
    /** How many times income is paid when every player passes; once unless given. */
    incomeRounds?: number
    /**
     * Who starts the first stock round: the player after the last to act (the default), or
     * after the last player who bought a lot on their turn.
     */
    firstStockPlayer?: 'after-last-actor' | 'after-last-purchase'
    /**
     * Lots of one price form a row, listed left to right, as 1828's (§6.1, §6.2): a player buys
     * only from the cheapest row still selling, and in a row of several only the one lot without
     * a bid once every other has one; the row's bids resolve, left to right, once each of its
     * lots has a bid. Without rows the first lot is bought and its bids resolve at once.
     */
    priceRows?: true
    /**
     * Whether a lot holds one bid only, a higher bid releasing the earlier bidder's, so that it is
     * never contested, as 1828's $250 privates (§6.1).
     */
    singleBid?(lotId: string): boolean
    award(state: State, award: AuctionAward): void
    incomePayments(state: State): CashPayment[]
    /**
     * The kinds of the depot trains exported after an all-pass income round, where the rules
     * count that round as a set of operating rounds, as 18Chesapeake does (§9, §11.9).
     */
    incomeExports?(state: State): string[]
}
export type AuctionResolution =
    | { kind: 'award'; award: AuctionAward }
    | { kind: 'open-bidding'; lotId: string }
    | { kind: 'discount' }
    | { kind: 'income' }
    | { kind: 'complete' }
export type ResolvedAuction =
    | Exclude<AuctionResolution, { kind: 'income' | 'discount' }>
    | { kind: 'discount'; payments?: CashPayment[] }
    | { kind: 'income'; payments: CashPayment[] }
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
        const cash = finiteCashOwnedBy(this.state, { kind: 'player', playerId })
        return availableBidAmount(cash, this.commitments(), playerId, lotId)
    }
    price(lotId: string): number {
        const lot = this.lots.find((lot) => lot.id === lotId)
        assertExists(lot, 'Unknown auction lot')
        return lot.price - (lotId === this.discountedLot()?.id ? this.auction.discount : 0)
    }
    /**
     * The lot an all-pass discount lowers: the first lot, or under ``discount-next`` the first
     * still unsold, the cheapest where lots are listed by price (1882 §9); none once all are sold.
     */
    private discountedLot(): AuctionLot | undefined {
        const lotId =
            this.rules.allPass === 'discount-next'
                ? this.auction.remainingLotIds[0]
                : this.lots[0].id
        return this.lots.find((lot) => lot.id === lotId)
    }
    minimumBid(lotId: string): number {
        const bids = this.commitments()
            .filter((bid) => bid.lotId === lotId)
            .map((bid) => bid.amount)
        if (this.rules.firstBidAtPrice && !bids.length) return this.price(lotId)
        return Math.max(this.price(lotId), ...bids) + this.rules.increment
    }
    /**
     * The cheapest row of lots still selling, left to right: the first lot alone without price
     * rows.
     */
    private openRow(): string[] {
        const remaining = this.auction.remainingLotIds
        if (!this.rules.priceRows || !remaining.length) return remaining.slice(0, 1)
        const price = this.printedPrice(remaining[0])
        return remaining.filter((lotId) => this.printedPrice(lotId) === price)
    }
    /**
     * The lots by printed price, cheapest first, where the auction sells them in rows. The open
     * row is the one being auctioned, which all passing can make a dearer row (§6.1).
     */
    priceRows(): AuctionPriceRow[] {
        if (!this.rules.priceRows) return []
        const selling = this.auction.bidding?.lotId ?? this.openRow()[0]
        const openPrice = selling === undefined ? undefined : this.printedPrice(selling)
        const prices = [...new Set(this.lots.map((lot) => lot.price))]
        return prices.map((price) => {
            const lotIds = this.lots.filter((lot) => lot.price === price).map((lot) => lot.id)
            const remaining = lotIds.filter((id) => this.auction.remainingLotIds.includes(id))
            return {
                price,
                lotIds,
                status: !remaining.length ? 'sold' : price === openPrice ? 'open' : 'later',
                remaining: remaining.length,
                unbid: remaining.filter((id) => !this.hasBid(id)).length
            }
        })
    }
    private printedPrice(lotId: string): number {
        const lot = this.lots.find((lot) => lot.id === lotId)
        assertExists(lot, 'Unknown auction lot')
        return lot.price
    }
    private hasBid(lotId: string): boolean {
        return this.auction.reservations.some((bid) => bid.lotId === lotId)
    }
    /** The lots a player may only buy at their price, never bid on. */
    buyOnlyLotIds(): string[] {
        const row = this.openRow()
        return row.filter(
            (lotId) =>
                !this.hasBid(lotId) && row.every((other) => other === lotId || this.hasBid(other))
        )
    }
    canPurchase(playerId: string, lotId: string): boolean {
        return (
            !this.auction.completed &&
            !this.auction.bidding &&
            !this.resolution() &&
            playerId === this.playerId &&
            this.buyOnlyLotIds().includes(lotId) &&
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
                : !this.auction.remainingLotIds.includes(lotId) ||
                  this.buyOnlyLotIds().includes(lotId)
        )
            return false
        return (
            amount >= this.minimumBid(lotId) &&
            amount <= this.availableCash(playerId, lotId) &&
            (!this.rules.bidMultiple || amount % this.rules.bidMultiple === 0)
        )
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
            const single = this.rules.singleBid?.(lotId) === true
            this.auction.reservations = this.auction.reservations.filter(
                (bid) => bid.lotId !== lotId || (!single && bid.playerId !== playerId)
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
        this.buyOnTurn(award)
        return award
    }
    /** A lot the player on turn takes at its price, after which play passes to their left. */
    private buyOnTurn(award: AuctionAward): void {
        this.award(award)
        if (this.rules.firstStockPlayer === 'after-last-purchase')
            this.auction.lastPurchaserId = award.playerId
        this.advanceOuterTurn()
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
        const row = this.openRow()
        const lotId = row[0]
        const bids = row.every((id) => this.hasBid(id))
            ? this.auction.reservations.filter((bid) => bid.lotId === lotId)
            : []
        if (bids.length === 1)
            return {
                kind: 'award',
                award: { lotId, playerId: bids[0].playerId, price: bids[0].amount }
            }
        if (bids.length > 1) return { kind: 'open-bidding', lotId }
        if (this.auction.passedPlayerIds.length !== this.state.players.length) return undefined
        if (this.rules.allPass === 'resolve-bids-then-income') return this.pendingBidResolution()
        if (this.rules.allPass === 'discount-next') return { kind: 'discount' }
        if (this.rules.allPass === 'discount-and-income')
            return {
                kind: this.auction.remainingLotIds.includes(this.lots[0].id) ? 'discount' : 'income'
            }
        return { kind: this.auction.awards.length ? 'income' : 'discount' }
    }
    /** After everyone passes, each lot's pending bids resolve in order as if it were current. */
    private pendingBidResolution(): AuctionResolution {
        for (const lotId of this.auction.remainingLotIds) {
            const bids = this.auction.reservations.filter((bid) => bid.lotId === lotId)
            if (bids.length === 1)
                return {
                    kind: 'award',
                    award: { lotId, playerId: bids[0].playerId, price: bids[0].amount }
                }
            if (bids.length > 1) return { kind: 'open-bidding', lotId }
        }
        return { kind: 'income' }
    }
    /** The player who starts the first stock round once every lot is sold. */
    firstStockPlayerId(): string {
        const purchaser = this.auction.lastPurchaserId
        return this.rules.firstStockPlayer === 'after-last-purchase' && purchaser
            ? this.nextPlayer(purchaser)
            : this.auction.nextPlayerId
    }
    resolve(actionId: string): ResolvedAuction {
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
                const lot = this.discountedLot()
                assertExists(lot, 'Every player passing leaves a lot to discount')
                this.auction.discount = Math.min(
                    lot.price,
                    this.auction.discount + this.rules.increment
                )
                this.auction.passedPlayerIds = []
                const payments =
                    this.rules.allPass === 'discount-and-income' && this.auction.awards.length
                        ? this.payIncome()
                        : []
                if (this.price(lot.id) === 0)
                    this.buyOnTurn({ lotId: lot.id, playerId: this.auction.nextPlayerId, price: 0 })
                return { kind: 'discount', ...(payments.length ? { payments } : {}) }
            }
            case 'income': {
                const payments = this.payIncome()
                this.auction.passedPlayerIds = []
                return { kind: 'income', payments }
            }
            case 'complete':
                this.auction.completed = true
                break
        }
        return result
    }
    private payIncome(): CashPayment[] {
        const payments: CashPayment[] = []
        for (let round = 0; round < (this.rules.incomeRounds ?? 1); round++) {
            const paid = this.rules.incomePayments(this.state)
            settleCashPayments(this.state, paid)
            payments.push(...paid)
        }
        return payments
    }
    private award(award: AuctionAward): void {
        if (this.rules.allPass === 'discount-next' && award.lotId === this.discountedLot()?.id)
            this.auction.discount = 0
        this.rules.award(this.state, award)
        this.auction.awards.push(award)
        this.auction.remainingLotIds = this.auction.remainingLotIds.filter(
            (lotId) => lotId !== award.lotId
        )
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
