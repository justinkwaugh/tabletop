import { assert, assertExists } from '@tabletop/common'
import {
    PlaceBids,
    committedCash,
    evaluateBids,
    finiteCashOwnedBy,
    leadingBid,
    lowestBid,
    withBids,
    type BidBoxBid,
    type BidBoxState,
    type BidBoxes,
    type BidRequest,
    type EighteenXXTitleRules,
    type StockState
} from '@tabletop/18xx'
import {
    getStagedSelectionValue,
    pushStagedSelectionValue,
    undoableStagedSelection,
    type LocalSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { MoneyFormat } from '../presentation/money.js'
import type { ModuleSession } from './moduleSession.js'

export type BidBoxSession = ModuleSession<
    StockState & { bidBoxes?: BidBoxes; machineState: string },
    Pick<EighteenXXTitleRules, 'bidBoxRules'>
>

/** A lot in its box, with every bid on it, the highest first. */
export type BidBoxLot = {
    boxId: string
    lotId: string
    bids: readonly BidBoxBid[]
    /** The bid the player is preparing on the lot this turn. */
    drafted?: number
    /** The lowest bid the player could add or change to, if they may bid on the lot at all. */
    lowest?: number
    /** Why the player may not bid on the lot now. */
    reason?: string
}

type DraftStages = { bid: BidRequest }
const DraftOrder = ['bid'] as const satisfies readonly (keyof DraftStages)[]

type BoxedState = BidBoxState & { bidBoxes: BidBoxes }

/**
 * Bidding in the boxes of a stock round (1822 §4.9): the player prepares a bid in one box, sets
 * its amount and places it as one Action; the turn may go on to place more. Preparing a bid in
 * another box drops the first. Each press on a bid is a step Undo takes back.
 */
export class BidBoxModule {
    #draft = $state<StagedSelectionState<DraftStages>>({})
    /** The prepared bid as a staged selection, for the session's Undo. */
    readonly selection: LocalSelection = undoableStagedSelection(
        DraftOrder,
        () => this.#draft,
        (draft) => (this.#draft = draft)
    )
    constructor(private readonly session: BidBoxSession) {}

    private hasBidBoxes(state: BidBoxState): state is BoxedState {
        return state.bidBoxes !== undefined
    }

    private readonly state = $derived.by((): BoxedState | undefined => {
        const state = this.session.state
        return this.hasBidBoxes(state) ? state : undefined
    })
    private readonly rules = $derived.by(() => this.session.rules.bidBoxRules)
    /** Whether the title has bid boxes at all. */
    readonly available = $derived.by(() => !!this.state && !!this.rules)
    readonly canBid = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('PlaceBids')
    )
    /** The bid being prepared, if any. */
    readonly drafted = $derived.by((): BidRequest | undefined =>
        this.canBid ? getStagedSelectionValue<DraftStages, 'bid'>(this.#draft, 'bid') : undefined
    )
    private get boxRules() {
        const rules = this.rules
        assertExists(rules, 'Bidding in boxes is for a title with bid box rules')
        return rules
    }
    readonly bidsPerTurn = $derived.by(() => this.boxRules.bidsPerTurn)
    /** The bids the turn has placed so far. */
    readonly bidsThisTurn = $derived.by(() =>
        this.canBid ? (this.state?.bidBoxes.turnBids ?? 0) : 0
    )
    readonly increment = $derived.by(() => this.boxRules.increment)

    private evaluate(bid: BidRequest) {
        const playerId = this.session.playerId
        if (!this.state || !this.rules || !playerId) return { reason: 'Bidding is closed.' }
        return evaluateBids(this.state, this.rules, playerId, [bid])
    }

    readonly lots = $derived.by((): readonly BidBoxLot[] => {
        const state = this.state
        const rules = this.rules
        if (!state || !rules) return []
        return state.bidBoxes.boxes.map(({ boxId, lotId }): BidBoxLot => {
            const bids = state.bidBoxes.bids
                .filter((bid) => bid.lotId === lotId)
                .toSorted((a, b) => b.amount - a.amount)
            const drafted = this.drafted?.lotId === lotId ? this.drafted.amount : undefined
            if (!this.canBid) return { boxId, lotId, bids }
            const lowest = lowestBid(state, rules, lotId)
            const reason = this.evaluate({ lotId, amount: drafted ?? lowest }).reason
            return {
                boxId,
                lotId,
                bids,
                ...(drafted === undefined ? {} : { drafted }),
                ...(reason && drafted === undefined ? { reason } : { lowest })
            }
        })
    })
    /** A player's bids on the lots in the boxes, each marked where it is the highest. */
    playerBids(playerId: string): { lotId: string; amount: number; leading: boolean }[] {
        return this.lots.flatMap(({ lotId, bids }) => {
            const place = bids.findIndex((bid) => bid.playerId === playerId)
            const bid = bids[place]
            return bid ? [{ lotId, amount: bid.amount, leading: place === 0 }] : []
        })
    }
    /** The highest bid on a lot, if any. */
    leader(lotId: string): BidBoxBid | undefined {
        return this.state ? leadingBid(this.state, lotId) : undefined
    }
    /** The bidding tokens a player has left, each lot they have bid on holding one. */
    tokensFree(playerId: string): number {
        const state = this.state
        if (!state || !this.rules) return 0
        const drafted = playerId === this.session.playerId ? this.drafted : undefined
        const lots = new Set([
            ...state.bidBoxes.bids
                .filter((bid) => bid.playerId === playerId)
                .map((bid) => bid.lotId),
            ...(drafted ? [drafted.lotId] : [])
        ])
        return Math.max(0, this.rules.tokens(state, playerId) - lots.size)
    }
    tokens(playerId: string): number {
        return this.state && this.rules ? this.rules.tokens(this.state, playerId) : 0
    }
    /** The cash a player's highest bids reserve, the prepared bid included for the bidder. */
    reserved(playerId: string): number {
        const state = this.state
        if (!state) return 0
        if (playerId !== this.session.playerId || !this.drafted)
            return committedCash(state, playerId)
        const bids = withBids(state.bidBoxes.bids, playerId, [this.drafted])
        return committedCash({ ...state, bidBoxes: { ...state.bidBoxes, bids } }, playerId)
    }
    cash(playerId: string): number {
        return this.state ? finiteCashOwnedBy(this.state, { kind: 'player', playerId }) : 0
    }

    /** Why an amount the player typed for a lot is no bid they may prepare. */
    typedBidReason(lot: BidBoxLot, amount: number, money: MoneyFormat): string | undefined {
        if (!Number.isFinite(amount)) return 'Type the amount of the bid.'
        if (lot.lowest !== undefined && amount < lot.lowest)
            return `The lowest bid on this lot is ${money(lot.lowest)}.`
        if (amount % this.increment !== 0) return `Bids go up in steps of ${money(this.increment)}.`
        return this.draftReason(lot.lotId, amount)
    }
    /** Why the player may not prepare this bid. */
    draftReason(lotId: string, amount: number): string | undefined {
        return this.canBid ? this.evaluate({ lotId, amount }).reason : 'Bidding is closed.'
    }
    canDraft(lotId: string, amount: number): boolean {
        return !this.draftReason(lotId, amount)
    }
    /** Prepares a bid on a lot in place of any other, or changes its amount. */
    draft(lotId: string, amount: number): void {
        assert(this.canDraft(lotId, amount), 'This bid cannot be made')
        this.#draft = pushStagedSelectionValue(this.#draft, DraftOrder, 'bid', { lotId, amount })
    }
    readonly canPlace = $derived.by(
        () => this.canBid && !!this.drafted && !this.evaluate(this.drafted).reason
    )
    async place(): Promise<void> {
        const bid = this.drafted
        assert(this.canPlace && bid, 'Prepare a bid to place')
        await this.session.applyAction(
            this.session.createPlayerAction(PlaceBids, {
                bids: [{ lotId: bid.lotId, amount: bid.amount }]
            })
        )
    }
}
