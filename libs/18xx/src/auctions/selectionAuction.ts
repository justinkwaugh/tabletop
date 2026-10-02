import * as Type from 'typebox'
import { assert, assertExists, SimpleAuction, type GameState } from '@tabletop/common'
import { finiteCashOwnedBy, type FinancialState } from '../finance/finance.js'
import { AuctionAward, type AuctionLot } from './waterfallAuction.js'
import { PassableBidding, validBidStep } from './passableBidding.js'

export const SelectionAuction = Type.Object(
    {
        remainingLotIds: Type.Array(Type.String()),
        nominatorId: Type.String(),
        passedPlayerIds: Type.Array(Type.String(), { uniqueItems: true }),
        bidding: Type.Optional(
            Type.Object(
                { lotId: Type.String(), nominatorId: Type.String(), auction: SimpleAuction },
                { additionalProperties: false }
            )
        ),
        awards: Type.Array(AuctionAward),
        closedLotIds: Type.Array(Type.String()),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type SelectionAuction = Type.Static<typeof SelectionAuction>
export const SelectionAuctionFields = { selectionAuction: Type.Optional(SelectionAuction) }
export type SelectionAuctionState = FinancialState &
    Pick<GameState, 'players' | 'activePlayerIds' | 'turnManager'> &
    Type.Static<Type.TObject<typeof SelectionAuctionFields>>

/**
 * An opening in which players in turn choose any remaining lot to auction, or pass; once every
 * player has passed in succession, the unsold lots close.
 */
export interface SelectionAuctionRules {
    lots(state: FinancialState): readonly AuctionLot[]
    /** The remaining lots a player may nominate now. */
    nominationLotIds(state: SelectionAuctionState): readonly string[]
    /** Whether a player may pass instead of nominating a lot. */
    passingWhileNominating: boolean
    openingBid(state: SelectionAuctionState, lotId: string): number
    increment: number
    award(state: SelectionAuctionState, award: AuctionAward): void
    closeUnsold(state: SelectionAuctionState, lotIds: readonly string[]): void
}
export const SelectionAuctionResolution = Type.Union([
    Type.Object(
        { kind: Type.Literal('award'), award: AuctionAward },
        { additionalProperties: false }
    ),
    Type.Object(
        { kind: Type.Literal('close-unsold'), lotIds: Type.Array(Type.String()) },
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
            : this.rules.openingBid(this.state, lotId)
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
            (!!this.auction.bidding || this.rules.passingWhileNominating)
        )
    }
    nominate(playerId: string, lotId: string, amount: number, actionId: string): void {
        assert(this.canNominate(playerId, lotId, amount), 'Invalid nomination')
        this.auction.passedPlayerIds = []
        this.auction.bidding = {
            lotId,
            nominatorId: playerId,
            auction: PassableBidding.open(
                actionId,
                this.state.turnManager.turnOrder,
                playerId,
                amount
            )
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
            return winner
                ? {
                      kind: 'award',
                      award: {
                          lotId: bidding.lotId,
                          playerId: winner.playerId,
                          price: winner.amount
                      }
                  }
                : undefined
        }
        if (!this.auction.remainingLotIds.length) return { kind: 'complete' }
        if (this.auction.passedPlayerIds.length === this.state.players.length)
            return { kind: 'close-unsold', lotIds: [...this.auction.remainingLotIds] }
        return undefined
    }
    resolve(): SelectionAuctionResolution {
        const resolution = this.resolution()
        assertExists(resolution, 'No auction consequence is pending')
        switch (resolution.kind) {
            case 'award': {
                const bidding = this.requireBidding()
                this.rules.award(this.state, resolution.award)
                this.auction.awards.push(resolution.award)
                this.auction.remainingLotIds = this.auction.remainingLotIds.filter(
                    (id) => id !== resolution.award.lotId
                )
                this.auction.nominatorId = this.nextNominator(bidding.nominatorId)
                delete this.auction.bidding
                if (!this.auction.remainingLotIds.length) this.auction.completed = true
                break
            }
            case 'close-unsold':
                this.rules.closeUnsold(this.state, resolution.lotIds)
                this.auction.closedLotIds.push(...resolution.lotIds)
                this.auction.remainingLotIds = []
                this.auction.completed = true
                break
            case 'complete':
                this.auction.completed = true
                break
        }
        return resolution
    }
    private affords(playerId: string, lotId: string, amount: number): boolean {
        return (
            validBidStep(amount, this.minimumBid(lotId), this.rules.increment) &&
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
        return (
            following.find((id) => !this.auction.passedPlayerIds.includes(id)) ?? following[0]
        )
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
