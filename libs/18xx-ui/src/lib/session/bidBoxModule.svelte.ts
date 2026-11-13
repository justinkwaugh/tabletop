import { assert } from '@tabletop/common'
import {
    PlaceBids,
    committedCash,
    evaluateBids,
    finiteCashOwnedBy,
    leadingBid,
    lowestBid,
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

type DraftStages = { bids: BidRequest[] }
const DraftOrder = ['bids'] as const satisfies readonly (keyof DraftStages)[]

type BoxedState = BidBoxState & { bidBoxes: BidBoxes }

function hasBidBoxes(state: BidBoxState): state is BoxedState {
    return state.bidBoxes !== undefined
}

/**
 * Bidding in the boxes of a stock round (1822 §4.9): a turn's bids are prepared one at a time and
 * placed together as one Action. Each press on a bid is a step Undo takes back.
 */
export class BidBoxModule {
    #draft = $state<StagedSelectionState<DraftStages>>({})
    /** The prepared bids as a staged selection, for the session's Undo. */
    readonly selection: LocalSelection = undoableStagedSelection(
        DraftOrder,
        () => this.#draft,
        (draft) => (this.#draft = draft)
    )
    constructor(private readonly session: BidBoxSession) {}

    private readonly state = $derived.by((): BoxedState | undefined => {
        const state = this.session.state
        return hasBidBoxes(state) ? state : undefined
    })
    private readonly rules = $derived.by(() => this.session.rules.bidBoxRules)
    /** Whether the title has bid boxes at all. */
    readonly available = $derived.by(() => !!this.state && !!this.rules)
    readonly canBid = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('PlaceBids')
    )
    /** The bids prepared this turn, in the order they were made. */
    readonly drafted = $derived.by((): readonly BidRequest[] =>
        this.canBid ? (getStagedSelectionValue<DraftStages, 'bids'>(this.#draft, 'bids') ?? []) : []
    )
    readonly bidsPerTurn = $derived.by(() => this.rules?.bidsPerTurn ?? 0)
    readonly increment = $derived.by(() => this.rules?.increment ?? 1)

    private evaluate(bids: readonly BidRequest[]) {
        const playerId = this.session.playerId
        if (!this.state || !this.rules || !playerId) return { reason: 'Bidding is closed.' }
        return evaluateBids(this.state, this.rules, playerId, bids)
    }
    private withBid(lotId: string, amount: number): BidRequest[] {
        return [...this.drafted.filter((bid) => bid.lotId !== lotId), { lotId, amount }]
    }

    readonly lots = $derived.by((): readonly BidBoxLot[] => {
        const state = this.state
        const rules = this.rules
        if (!state || !rules) return []
        return state.bidBoxes.boxes.map(({ boxId, lotId }): BidBoxLot => {
            const bids = state.bidBoxes.bids
                .filter((bid) => bid.lotId === lotId)
                .toSorted((a, b) => b.amount - a.amount)
            const drafted = this.drafted.find((bid) => bid.lotId === lotId)?.amount
            if (!this.canBid) return { boxId, lotId, bids }
            const lowest = lowestBid(state, rules, lotId)
            const reason = this.evaluate(this.withBid(lotId, drafted ?? lowest)).reason
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
        const drafted = playerId === this.session.playerId ? this.drafted : []
        const lots = new Set([
            ...state.bidBoxes.bids
                .filter((bid) => bid.playerId === playerId)
                .map((bid) => bid.lotId),
            ...drafted.map((bid) => bid.lotId)
        ])
        return Math.max(0, this.rules.tokens(state, playerId) - lots.size)
    }
    tokens(playerId: string): number {
        return this.state && this.rules ? this.rules.tokens(this.state, playerId) : 0
    }
    /** What a player's highest bids commit of their cash, the prepared bids included for the bidder. */
    committed(playerId: string): number {
        const state = this.state
        if (!state) return 0
        if (playerId !== this.session.playerId || !this.drafted.length)
            return committedCash(state, playerId)
        const bids = [
            ...state.bidBoxes.bids.filter(
                (bid) =>
                    !(
                        bid.playerId === playerId &&
                        this.drafted.some((drafted) => drafted.lotId === bid.lotId)
                    )
            ),
            ...this.drafted.map((bid) => ({ ...bid, playerId }))
        ]
        return committedCash({ ...state, bidBoxes: { ...state.bidBoxes, bids } }, playerId)
    }
    cash(playerId: string): number {
        return this.state ? finiteCashOwnedBy(this.state, { kind: 'player', playerId }) : 0
    }

    /** Why the player may not prepare this bid beside those already prepared. */
    draftReason(lotId: string, amount: number): string | undefined {
        return this.canBid
            ? this.evaluate(this.withBid(lotId, amount)).reason
            : 'Bidding is closed.'
    }
    canDraft(lotId: string, amount: number): boolean {
        return !this.draftReason(lotId, amount)
    }
    /** Prepares a bid on a lot, or changes the one prepared. */
    draft(lotId: string, amount: number): void {
        assert(this.canDraft(lotId, amount), 'This bid cannot be made')
        this.#draft = pushStagedSelectionValue(
            this.#draft,
            DraftOrder,
            'bids',
            this.withBid(lotId, amount)
        )
    }
    /** Takes a prepared bid off its lot. */
    withdraw(lotId: string): void {
        this.#draft = pushStagedSelectionValue(
            this.#draft,
            DraftOrder,
            'bids',
            this.drafted.filter((bid) => bid.lotId !== lotId)
        )
    }
    readonly canPlace = $derived.by(
        () => this.canBid && this.drafted.length > 0 && !this.evaluate(this.drafted).reason
    )
    async place(): Promise<void> {
        assert(this.canPlace, 'Prepare a bid to place')
        const bids = this.drafted.map(({ lotId, amount }) => ({ lotId, amount }))
        await this.session.applyAction(this.session.createPlayerAction(PlaceBids, { bids }))
    }
}
