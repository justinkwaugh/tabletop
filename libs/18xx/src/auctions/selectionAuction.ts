import * as Type from 'typebox'
import {
    assert,
    assertExists,
    PassableBidding,
    SimpleAuction,
    isValidBidStep,
    type GameState
} from '@tabletop/common'
import { finiteCashOwnedBy, type FinancialState } from '../finance/finance.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { AuctionAward, type AuctionLot } from './waterfallAuction.js'

export const SelectionAuction = Type.Object(
    {
        remainingLotIds: Type.Array(Type.String()),
        nominatorId: Type.String(),
        passedPlayerIds: Type.Array(Type.String(), { uniqueItems: true }),
        bidding: Type.Optional(
            Type.Object(
                {
                    lotId: Type.String(),
                    nominatorId: Type.String(),
                    /** The player who began the lot's auction by passing, before its nominator. */
                    openerId: Type.Optional(Type.String()),
                    auction: SimpleAuction
                },
                { additionalProperties: false }
            )
        ),
        awards: Type.Array(AuctionAward),
        closedLotIds: Type.Array(Type.String()),
        /** How far every player's passing has lowered the next lot's opening bid. */
        discount: Type.Optional(Type.Integer({ minimum: 1 })),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type SelectionAuction = Type.Static<typeof SelectionAuction>
export const SelectionAuctionFields = { selectionAuction: Type.Optional(SelectionAuction) }
export type SelectionAuctionState = FinancialState &
    Pick<GameState, 'players' | 'activePlayerIds' | 'turnManager'> &
    Type.Static<Type.TObject<typeof SelectionAuctionFields>>

/** The tiers a title deals its lots into, the first tier first. */
export type LotTiers = {
    /** A sold or removed lot keeps its slot; `null` is a slot emptied by a game that began before slots were kept. */
    slots: readonly (readonly (string | null)[])[]
    /** The tier open for nomination once these lots have gone too; undefined when none is left. */
    openTier(goneLotIds: readonly string[]): number | undefined
}

/**
 * An opening in which players in turn choose a remaining lot to auction, or pass; once every
 * player has passed in succession, the unsold lots close.
 */
export interface SelectionAuctionRules {
    lots(state: FinancialState): readonly AuctionLot[]
    /** The remaining lots a player may nominate now. */
    nominationLotIds(state: SelectionAuctionState): readonly string[]
    tiers?(state: SelectionAuctionState): LotTiers | undefined
    /** Whether a player may pass instead of nominating a lot. */
    passingWhileNominating(state: SelectionAuctionState): boolean
    openingBid(state: SelectionAuctionState, lotId: string): number
    increment: number
    award(state: SelectionAuctionState, award: AuctionAward): void
    /** Unsold lots that leave the game because this award was made. */
    lotsRemovedBy?(state: SelectionAuctionState, award: AuctionAward): readonly string[]
    /** Whether the player after the winner, rather than after the nominator, nominates next. */
    nominationFollowsWinner?(state: SelectionAuctionState): boolean
    /** The winner opens the next lot themselves, as 18RoyalGorge's private auction (AU-4). */
    winnerNominatesNext?: true
    /**
     * The player after the lot's opener nominates next: the first to act on it, though they
     * passed before another player nominated it, as 1880's starting player (§V).
     */
    nominationFollowsOpener?: true
    /** Players who passed on a lot before its nomination may not bid on it (1880 §V). */
    passesWithdraw?: true
    closeUnsold(state: SelectionAuctionState, lotIds: readonly string[]): void
    /**
     * When every player passes in succession while lots remain, the next lot's opening bid falls
     * by this much instead of the unsold lots closing, and the player who began the passes
     * nominates again; once it falls to nothing, that player receives the lot free (1861 §9.4).
     */
    allPassDiscount?: number
    /**
     * When every player passes in succession, only the lot up for nomination closes, and the
     * player who began the passes nominates the next, as 18RoyalGorge's privates (AU-2).
     */
    allPassClosesLot?: true
    /**
     * When every player passes on the lot, its privates pay their income, as in an operating
     * round of nothing else, and the lot is offered again from the same player, as 1880's lots
     * after P1 (§V); none for lots that discount or close instead.
     */
    allPassIncome?(state: SelectionAuctionState, lotId: string): CashPayment[] | undefined
    /** The seat order once every lot is sold, its first player with priority (1880 §V). */
    firstStockOrder?(state: SelectionAuctionState): readonly string[]
}
export const SelectionAuctionResolution = Type.Union([
    Type.Object(
        {
            kind: Type.Literal('award'),
            award: AuctionAward,
            removedLotIds: Type.Optional(Type.Array(Type.String(), { minItems: 1 }))
        },
        { additionalProperties: false }
    ),
    Type.Object(
        { kind: Type.Literal('close-unsold'), lotIds: Type.Array(Type.String()) },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Literal('discount'),
            lotId: Type.String(),
            discount: Type.Integer({ minimum: 1 }),
            nominatorId: Type.String()
        },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Literal('income'),
            lotId: Type.String(),
            payments: Type.Array(CashPayment),
            nominatorId: Type.String()
        },
        { additionalProperties: false }
    ),
    Type.Object({ kind: Type.Literal('complete') }, { additionalProperties: false })
])
export type SelectionAuctionResolution = Type.Static<typeof SelectionAuctionResolution>

export class SelectionAuctionModel {
    constructor(
        private readonly state: SelectionAuctionState,
        readonly rules: SelectionAuctionRules
    ) {}
    get auction(): SelectionAuction {
        assertExists(this.state.selectionAuction, 'The selection auction is missing')
        return this.state.selectionAuction
    }
    get lots(): readonly AuctionLot[] {
        return this.rules.lots(this.state)
    }
    get tiers(): LotTiers['slots'] | undefined {
        return this.rules.tiers?.(this.state)?.slots
    }
    openTier(goneLotIds: readonly string[] = []): number | undefined {
        const tiers = this.rules.tiers?.(this.state)
        assertExists(tiers, 'Only a tiered auction has an open tier')
        return tiers.openTier(goneLotIds)
    }
    get nominationLotIds(): readonly string[] {
        return this.rules.nominationLotIds(this.state)
    }
    get playerId(): string | undefined {
        const bidding = this.auction.bidding
        return bidding
            ? new PassableBidding(bidding.auction).currentBidderId
            : this.auction.nominatorId
    }
    cash(playerId: string): number {
        return finiteCashOwnedBy(this.state, { kind: 'player', playerId })
    }
    minimumBid(lotId: string): number {
        const bidding = this.auction.bidding
        return bidding?.lotId === lotId
            ? new PassableBidding(bidding.auction).highBid + this.rules.increment
            : Math.max(0, this.rules.openingBid(this.state, lotId) - this.discountOn(lotId))
    }
    private discountOn(lotId: string): number {
        const discount = this.auction.discount
        return discount && this.nominationLotIds[0] === lotId ? discount : 0
    }
    get someLotOpensOffValue(): boolean {
        return this.lots.some(
            (lot) =>
                this.auction.remainingLotIds.includes(lot.id) &&
                this.minimumBid(lot.id) !== lot.price
        )
    }
    /** The unsold lots that would leave the game if this award were made now. */
    lotsRemovedBy(award: AuctionAward): readonly string[] {
        return this.rules.lotsRemovedBy?.(this.state, award) ?? []
    }
    canNominate(playerId: string, lotId: string, amount: number): boolean {
        return (
            !this.auction.completed &&
            !this.auction.bidding &&
            !this.resolution() &&
            playerId === this.auction.nominatorId &&
            this.rules.nominationLotIds(this.state).includes(lotId) &&
            this.affords(playerId, lotId, amount)
        )
    }
    canBid(playerId: string, lotId: string, amount: number): boolean {
        return (
            !!this.auction.bidding &&
            this.auction.bidding.lotId === lotId &&
            !this.resolution() &&
            playerId === this.playerId &&
            this.affords(playerId, lotId, amount)
        )
    }
    canPass(playerId: string): boolean {
        return (
            !this.auction.completed &&
            !this.resolution() &&
            playerId === this.playerId &&
            (!!this.auction.bidding || this.rules.passingWhileNominating(this.state))
        )
    }
    nominate(playerId: string, lotId: string, amount: number, actionId: string): void {
        assert(this.canNominate(playerId, lotId, amount), 'Invalid nomination')
        const passed = this.auction.passedPlayerIds
        const openerId = passed[0]
        this.auction.passedPlayerIds = []
        const bidders = this.rules.passesWithdraw
            ? this.state.turnManager.turnOrder.filter((id) => !passed.includes(id))
            : this.state.turnManager.turnOrder
        this.auction.bidding = {
            lotId,
            nominatorId: playerId,
            ...(openerId ? { openerId } : {}),
            auction: PassableBidding.open(actionId, bidders, playerId, amount)
        }
        this.withdrawUnable()
    }
    bid(playerId: string, lotId: string, amount: number): void {
        assert(this.canBid(playerId, lotId, amount), 'Invalid auction bid')
        const bidding = this.requireBidding()
        bidding.auction = new PassableBidding(bidding.auction).bid(playerId, amount)
        this.withdrawUnable()
    }
    pass(playerId: string): void {
        assert(this.canPass(playerId), 'Invalid auction pass')
        const bidding = this.auction.bidding
        if (bidding) {
            bidding.auction = new PassableBidding(bidding.auction).pass(playerId)
            return
        }
        this.auction.passedPlayerIds.push(playerId)
        this.auction.nominatorId = this.nextNominator(playerId)
    }
    resolution(): SelectionAuctionResolution | undefined {
        if (this.auction.completed) return undefined
        const bidding = this.auction.bidding
        if (bidding) {
            const winner = new PassableBidding(bidding.auction).winner
            if (!winner) return undefined
            const award = { lotId: bidding.lotId, playerId: winner.playerId, price: winner.amount }
            const removedLotIds = [...this.lotsRemovedBy(award)]
            return { kind: 'award', award, ...(removedLotIds.length ? { removedLotIds } : {}) }
        }
        if (!this.auction.remainingLotIds.length) return { kind: 'complete' }
        if (this.auction.passedPlayerIds.length === this.state.players.length) {
            const [lotId] = this.rules.nominationLotIds(this.state)
            const payments = lotId ? this.rules.allPassIncome?.(this.state, lotId) : undefined
            if (lotId && payments)
                return {
                    kind: 'income',
                    lotId,
                    payments,
                    nominatorId: this.auction.passedPlayerIds[0]
                }
            if (this.rules.allPassDiscount)
                return this.discountResolution(this.rules.allPassDiscount)
            return this.rules.allPassClosesLot && lotId
                ? { kind: 'close-unsold', lotIds: [lotId] }
                : { kind: 'close-unsold', lotIds: [...this.auction.remainingLotIds] }
        }
        return undefined
    }
    private discountResolution(step: number): SelectionAuctionResolution {
        const [lotId] = this.rules.nominationLotIds(this.state)
        assertExists(lotId, 'A discounted auction has a lot to nominate')
        const nominatorId = this.auction.passedPlayerIds[0]
        const discount = (this.auction.discount ?? 0) + step
        if (this.rules.openingBid(this.state, lotId) - discount > 0)
            return { kind: 'discount', lotId, discount, nominatorId }
        return { kind: 'award', award: { lotId, playerId: nominatorId, price: 0 } }
    }
    resolve(): SelectionAuctionResolution {
        const resolution = this.resolution()
        assertExists(resolution, 'No auction consequence is pending')
        switch (resolution.kind) {
            case 'award': {
                const { award } = resolution
                const bidding = this.auction.bidding
                const nominatorId =
                    (this.rules.nominationFollowsOpener ? bidding?.openerId : undefined) ??
                    bidding?.nominatorId ??
                    award.playerId
                const removed = resolution.removedLotIds ?? []
                this.rules.award(this.state, award)
                this.auction.awards.push(award)
                if (removed.length) {
                    this.rules.closeUnsold(this.state, removed)
                    this.auction.closedLotIds.push(...removed)
                }
                this.auction.remainingLotIds = this.auction.remainingLotIds.filter(
                    (id) => id !== award.lotId && !removed.includes(id)
                )
                this.auction.nominatorId = this.rules.winnerNominatesNext
                    ? award.playerId
                    : this.nextNominator(
                          this.rules.nominationFollowsWinner?.(this.state)
                              ? award.playerId
                              : nominatorId
                      )
                delete this.auction.bidding
                delete this.auction.discount
                this.auction.passedPlayerIds = []
                if (!this.auction.remainingLotIds.length) this.auction.completed = true
                break
            }
            case 'discount':
                this.auction.discount = resolution.discount
                this.auction.passedPlayerIds = []
                this.auction.nominatorId = resolution.nominatorId
                break
            case 'income':
                settleCashPayments(this.state, resolution.payments)
                this.auction.passedPlayerIds = []
                this.auction.nominatorId = resolution.nominatorId
                break
            case 'close-unsold':
                this.rules.closeUnsold(this.state, resolution.lotIds)
                this.auction.closedLotIds.push(...resolution.lotIds)
                this.auction.remainingLotIds = this.auction.remainingLotIds.filter(
                    (id) => !resolution.lotIds.includes(id)
                )
                if (this.auction.remainingLotIds.length) {
                    this.auction.nominatorId = this.auction.passedPlayerIds[0]
                    this.auction.passedPlayerIds = []
                } else this.auction.completed = true
                break
            case 'complete':
                this.auction.completed = true
                break
        }
        return resolution
    }
    private affords(playerId: string, lotId: string, amount: number): boolean {
        return (
            isValidBidStep(amount, this.minimumBid(lotId), this.rules.increment) &&
            amount <= this.cash(playerId)
        )
    }
    private requireBidding(): NonNullable<SelectionAuction['bidding']> {
        assertExists(this.auction.bidding, 'No lot is being auctioned')
        return this.auction.bidding
    }
    private withdrawUnable(): void {
        const bidding = this.requireBidding()
        bidding.auction = new PassableBidding(bidding.auction).withdrawBelow(
            this.minimumBid(bidding.lotId),
            (playerId) => this.cash(playerId)
        )
    }
    // Players who have passed are skipped until a lot is sold, as in the reference.
    private nextNominator(playerId: string): string {
        const order = this.state.turnManager.turnOrder
        const index = order.indexOf(playerId)
        assert(index >= 0, 'Unknown auction player')
        const following = order.map((_, offset) => order[(index + 1 + offset) % order.length])
        return following.find((id) => !this.auction.passedPlayerIds.includes(id)) ?? following[0]
    }
}

export function activeSelectionAuction(
    state: SelectionAuctionState & { machineState: string },
    rules: SelectionAuctionRules
): SelectionAuctionModel | undefined {
    return state.selectionAuction &&
        !state.selectionAuction.completed &&
        state.machineState === 'SelectionAuction'
        ? new SelectionAuctionModel(state, rules)
        : undefined
}

export function requireActiveSelectionAuction(
    state: SelectionAuctionState & { machineState: string },
    rules: SelectionAuctionRules
): SelectionAuctionModel {
    const model = activeSelectionAuction(state, rules)
    assertExists(model, 'The selection auction is not active')
    return model
}

export function validateSelectionAuction(state: {
    machineState: string
    selectionAuction?: SelectionAuction
    players: readonly { playerId: string }[]
    companies: readonly { id: string }[]
}): void {
    const auction = state.selectionAuction
    if (!auction) return
    assert(
        auction.completed !== (state.machineState === 'SelectionAuction'),
        'Selection auction progress must match its state'
    )
    assert(
        state.players.some((player) => player.playerId === auction.nominatorId),
        'Unknown nominating player'
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
        !auction.bidding || auction.remainingLotIds.includes(auction.bidding.lotId),
        'The lot being auctioned must remain'
    )
}
