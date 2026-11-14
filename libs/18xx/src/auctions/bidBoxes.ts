import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import { systemAction, titleAction } from '../actions/titleAction.js'
import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy } from '../finance/finance.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import {
    allPlayersPassed,
    recordStockAction,
    type StockRoundRules
} from '../stock/stockRoundRules.js'
import type { StockState } from '../stock/stockState.js'
import { isCompleteStockRound } from '../stock/completeStockRound.js'
import { isFinishStockTurn } from '../stock/finishStockTurn.js'

const Id = Type.String({ minLength: 1 })

export const BidBoxBid = Type.Object(
    { lotId: Id, playerId: Id, amount: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type BidBoxBid = Type.Static<typeof BidBoxBid>

/**
 * Lots offered in boxes through a stock round: players bid on them in their stock turns, and
 * the highest bid on each buys it once the round's turns are over (1822 §4.5, §4.9, §4.10).
 */
export const BidBoxes = Type.Object(
    {
        /** The stacks the boxes fill from, each with the lot that enters a box next first. */
        stacks: Type.Array(
            Type.Object({ id: Id, lotIds: Type.Array(Id) }, { additionalProperties: false })
        ),
        /** The lot in each filled box. */
        boxes: Type.Array(Type.Object({ boxId: Id, lotId: Id }, { additionalProperties: false })),
        /** Each player's bid on a lot, where their bidding token stands. */
        bids: Type.Array(BidBoxBid),
        /** The bids placed or raised so far in the stock turn under way. */
        turnBids: Type.Optional(Type.Integer({ minimum: 1 })),
        /** The round's bids have been settled; dropped as the round completes. */
        settled: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type BidBoxes = Type.Static<typeof BidBoxes>
export const BidBoxFields = { bidBoxes: BidBoxes }
export type BidBoxState = StockState & { bidBoxes?: BidBoxes }

/** The bid boxes of a title that plays with them. */
export function bidBoxesOf(state: BidBoxState): BidBoxes {
    assertExists(state.bidBoxes, 'Bid boxes belong to a title that plays with them')
    return state.bidBoxes
}

export const BidBoxAward = Type.Object(
    { lotId: Id, boxId: Id, playerId: Id, amount: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type BidBoxAward = Type.Static<typeof BidBoxAward>

/** What a title does as a round's bids are settled, recorded under its own schema. */
export interface BidBoxSettlement<Details extends Type.TObject = Type.TObject> {
    schema: Details
    /**
     * Gives each won lot to its bidder, who has paid the bank the bid, then deals with the lots
     * no one bid on and refills the boxes. `awards` come highest bid first, a box's order
     * breaking ties, the order 1822 places newly floated minors in (§4.10.2).
     */
    settle(state: BidBoxState, awards: readonly BidBoxAward[]): Type.Static<Details>
}

export interface BidBoxRules<Details extends Type.TObject = Type.TObject> {
    /** Bids are whole multiples of this amount. */
    increment: number
    /** How many bids a player may place or raise in one stock turn. */
    bidsPerTurn: number
    /** How many lots a player may have a bid on at once: their bidding tokens. */
    tokens(state: BidBoxState, playerId: string): number
    /** The lowest bid a lot opens at, its face value. */
    openingBid(state: BidBoxState, lotId: string): number
    /** Why the player may not bid on the lot, if they may not. */
    restriction?(state: BidBoxState, playerId: string, lotId: string): string | undefined
    round: StockRoundRules
    settlement: BidBoxSettlement<Details>
}

export function boxOfLot(state: BidBoxState, lotId: string): string | undefined {
    return bidBoxesOf(state).boxes.find((box) => box.lotId === lotId)?.boxId
}

/** The highest bid on a lot; bids on a lot are all different, each topping the last. */
export function leadingBid(state: BidBoxState, lotId: string): BidBoxBid | undefined {
    return bidBoxesOf(state)
        .bids.filter((bid) => bid.lotId === lotId)
        .reduce<BidBoxBid | undefined>(
            (best, bid) => (!best || bid.amount > best.amount ? bid : best),
            undefined
        )
}

/** The lots a player has the highest bid on. */
export function leadingLotIds(state: BidBoxState, playerId: string): string[] {
    return bidBoxesOf(state)
        .boxes.map((box) => box.lotId)
        .filter((lotId) => leadingBid(state, lotId)?.playerId === playerId)
}

/** What a player's highest bids commit of their cash (1822 §4.9.3). */
export function committedCash(state: BidBoxState, playerId: string): number {
    return leadingLotIds(state, playerId).reduce(
        (sum, lotId) => sum + (leadingBid(state, lotId)?.amount ?? 0),
        0
    )
}

/** The lowest bid the player could now make on a lot, whatever else may bar it. */
export function lowestBid(state: BidBoxState, rules: BidBoxRules, lotId: string): number {
    const leading = leadingBid(state, lotId)
    return leading ? leading.amount + rules.increment : rules.openingBid(state, lotId)
}

export const BidRequest = Type.Object(
    { lotId: Id, amount: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type BidRequest = Type.Static<typeof BidRequest>

export const PlacedBid = Type.Object(
    {
        ...BidRequest.properties,
        /** The player's earlier bid on the lot, which this one raises. */
        raisedFrom: Type.Optional(Type.Integer({ minimum: 0 })),
        /** The bid this one tops. */
        outbid: Type.Optional(
            Type.Object(
                { playerId: Id, amount: Type.Integer({ minimum: 0 }) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type PlacedBid = Type.Static<typeof PlacedBid>

/** The bids with a player's new ones in place of any they had on the same lots. */
export function withBids(
    bids: readonly BidBoxBid[],
    playerId: string,
    placed: readonly BidRequest[]
): BidBoxBid[] {
    return [
        ...bids.filter(
            (bid) =>
                !(bid.playerId === playerId && placed.some((entry) => entry.lotId === bid.lotId))
        ),
        ...placed.map(({ lotId, amount }) => ({ lotId, playerId, amount }))
    ]
}

export type BidEvaluation = { bids: PlacedBid[]; reason?: never } | { reason: string; bids?: never }

/**
 * Judges bids in the order given, each on the bids the earlier ones leave, after those the turn
 * has already placed.
 */
export function evaluateBids(
    state: BidBoxState,
    rules: BidBoxRules,
    playerId: string,
    requests: readonly BidRequest[]
): BidEvaluation {
    if (!requests.length) return { reason: 'Choose a lot to bid on.' }
    if (requests.length + (bidBoxesOf(state).turnBids ?? 0) > rules.bidsPerTurn)
        return { reason: `Only ${rules.bidsPerTurn} bids may be made in a turn.` }
    if (new Set(requests.map((request) => request.lotId)).size !== requests.length)
        return { reason: 'Bid once on a lot in a turn.' }
    let bids = bidBoxesOf(state).bids
    const projected = (): BidBoxState => ({ ...state, bidBoxes: { ...bidBoxesOf(state), bids } })
    const placed: PlacedBid[] = []
    for (const { lotId, amount } of requests) {
        const view = projected()
        if (!boxOfLot(view, lotId)) return { reason: 'This lot is not on offer.' }
        const restriction = rules.restriction?.(view, playerId, lotId)
        if (restriction) return { reason: restriction }
        if (amount % rules.increment !== 0)
            return { reason: `Bids are multiples of ${rules.increment}.` }
        if (amount < lowestBid(view, rules, lotId))
            return { reason: 'The bid must top the highest bid on the lot.' }
        const leading = leadingBid(view, lotId)
        const own = bids.find((bid) => bid.lotId === lotId && bid.playerId === playerId)
        if (leading?.playerId === playerId)
            return { reason: 'A bid may be raised only once another has topped it.' }
        const lotsBidOn = new Set(
            bids.filter((bid) => bid.playerId === playerId).map((bid) => bid.lotId)
        ).size
        if (!own && lotsBidOn >= rules.tokens(view, playerId))
            return { reason: 'Every bidding token is on a lot.' }
        bids = withBids(bids, playerId, [{ lotId, amount }])
        if (
            committedCash(projected(), playerId) >
            finiteCashOwnedBy(state, { kind: 'player', playerId })
        )
            return { reason: 'The highest bids may not exceed the cash in hand.' }
        placed.push({
            lotId,
            amount,
            ...(own ? { raisedFrom: own.amount } : {}),
            ...(leading ? { outbid: { playerId: leading.playerId, amount: leading.amount } } : {})
        })
    }
    return { bids: placed }
}

/** Whether the player has any bid they could make this turn. */
export function canBid(state: BidBoxState, rules: BidBoxRules, playerId: string): boolean {
    return bidBoxesOf(state).boxes.some(
        ({ lotId }) =>
            evaluateBids(state, rules, playerId, [
                { lotId, amount: lowestBid(state, rules, lotId) }
            ]).bids
    )
}

const PlaceBidsAction = titleAction('PlaceBids', {
    bids: Type.Array(BidRequest, { minItems: 1 }),
    metadata: Type.Optional(
        Type.Object({ bids: Type.Array(PlacedBid) }, { additionalProperties: false })
    )
})
export const PlaceBids = PlaceBidsAction.schema
export type PlaceBids = Type.Static<typeof PlaceBids>
export const isPlaceBids = PlaceBidsAction.is

/**
 * Bids in a stock turn, in place of a purchase: new bids, or raises of bids since topped. A turn
 * may go on to place more, one Action each, up to the title's bids in a turn.
 */
export class HydratedPlaceBids extends PlaceBidsAction.Base {
    declare playerId: string
    declare bids: PlaceBids['bids']
    declare metadata?: PlaceBids['metadata']
    readonly #rules: BidBoxRules
    constructor(data: PlaceBids, rules: BidBoxRules) {
        super(data)
        this.#rules = rules
    }
    reason(state: BidBoxState): string | undefined {
        if (this.source !== ActionSource.User) return 'Bids are a player’s own.'
        if (!state.activePlayerIds.includes(this.playerId)) return 'It is not this player’s turn.'
        if (state.stockRound.turn.bought && !bidBoxesOf(state).turnBids)
            return 'This turn’s purchase has been made.'
        return evaluateBids(state, this.#rules, this.playerId, this.bids).reason
    }
    apply(state: HydratedEighteenXXState & BidBoxState): void {
        const reason = this.reason(state)
        assert(!reason, reason ?? 'Invalid bids')
        const evaluation = evaluateBids(state, this.#rules, this.playerId, this.bids)
        assertExists(evaluation.bids, 'Valid bids are evaluated')
        bidBoxesOf(state).bids = withBids(bidBoxesOf(state).bids, this.playerId, evaluation.bids)
        recordStockAction(state, this.playerId, this.#rules.round)
        state.stockRound.turn.bought = true
        bidBoxesOf(state).turnBids = (bidBoxesOf(state).turnBids ?? 0) + evaluation.bids.length
        this.metadata = { bids: evaluation.bids }
    }
}

const SettleFields = {
    metadata: Type.Optional(
        Type.Object(
            {
                awards: Type.Array(BidBoxAward),
                payments: Type.Array(CashPayment),
                details: Type.Unknown()
            },
            { additionalProperties: false }
        )
    )
}
const SettleBidBoxesAction = systemAction('SettleBidBoxes', SettleFields)
export const SettleBidBoxes = SettleBidBoxesAction.schema
export type SettleBidBoxes = Type.Static<typeof SettleBidBoxes>
export const isSettleBidBoxes = SettleBidBoxesAction.is

/** Whether a round whose turns are over still has its bids to settle. */
export function bidsAwaitSettlement(state: BidBoxState): boolean {
    return !state.stockRound.completed && allPlayersPassed(state) && !bidBoxesOf(state).settled
}

/** The winning bids, highest first, the earlier box first among equals. */
export function winningBids(state: BidBoxState): BidBoxAward[] {
    return bidBoxesOf(state)
        .boxes.flatMap(({ boxId, lotId }, order) => {
            const leading = leadingBid(state, lotId)
            return leading
                ? [
                      {
                          order,
                          award: {
                              lotId,
                              boxId,
                              playerId: leading.playerId,
                              amount: leading.amount
                          }
                      }
                  ]
                : []
        })
        .sort((a, b) => b.award.amount - a.award.amount || a.order - b.order)
        .map(({ award }) => award)
}

/** Once every player has passed, each lot with a bid is bought by its highest bidder. */
export class HydratedSettleBidBoxes extends SettleBidBoxesAction.Base {
    declare metadata?: SettleBidBoxes['metadata']
    readonly #rules: BidBoxRules
    constructor(data: SettleBidBoxes, rules: BidBoxRules) {
        super(data)
        this.#rules = rules
    }
    apply(state: HydratedEighteenXXState & BidBoxState): void {
        assert(
            this.source === ActionSource.System && bidsAwaitSettlement(state),
            'Bids are settled once the stock round’s turns are over'
        )
        const awards = winningBids(state)
        const payments = awards
            .filter((award) => award.amount > 0)
            .map((award) => ({
                from: { kind: 'player' as const, playerId: award.playerId },
                to: { kind: 'bank' as const },
                amount: award.amount
            }))
        settleCashPayments(state, payments)
        bidBoxesOf(state).bids = []
        bidBoxesOf(state).settled = true
        const details = this.#rules.settlement.settle(state, awards)
        this.metadata = { awards, payments, details }
    }
}

export function bidBoxActions(rules: BidBoxRules | undefined): ActionDefinition[] {
    if (!rules) return []
    // The settlement is published with the title's own record of it.
    const settled = Type.Object(
        {
            ...SettleBidBoxes.properties,
            metadata: Type.Optional(
                Type.Object(
                    {
                        awards: Type.Array(BidBoxAward),
                        payments: Type.Array(CashPayment),
                        details: rules.settlement.schema
                    },
                    { additionalProperties: false }
                )
            )
        },
        { additionalProperties: false }
    )
    return [
        defineAction(PlaceBids, isPlaceBids, (action) => new HydratedPlaceBids(action, rules)),
        defineAction(
            settled,
            isSettleBidBoxes,
            (action) => new HydratedSettleBidBoxes(action, rules)
        )
    ]
}

type State = HydratedEighteenXXState & BidBoxState

/**
 * A stock round with bid boxes: bids are a turn's alternative to a purchase, and the round's
 * bids are settled before it completes. A settlement that sells a train into a new phase hands
 * over to the phase change, which returns to the round.
 */
export class BidBoxStockRoundHandler<
    Hosted extends State
> implements EighteenXXStateHandler<Hosted> {
    constructor(
        private readonly handler: EighteenXXStateHandler<Hosted>,
        private readonly rules: BidBoxRules
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<Hosted>): boolean {
        const state = context.gameState
        if (action instanceof HydratedSettleBidBoxes)
            return action.source === ActionSource.System && bidsAwaitSettlement(state)
        if (bidsAwaitSettlement(state)) return false
        if (action instanceof HydratedPlaceBids) return !action.reason(state)
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<Hosted>): string[] {
        const state = context.gameState
        if (bidsAwaitSettlement(state)) return []
        const actions = this.handler.validActionsForPlayer(playerId, context)
        return state.activePlayerIds.includes(playerId) &&
            !state.stockRound.completed &&
            !allPlayersPassed(state) &&
            (!state.stockRound.turn.bought || !!bidBoxesOf(state).turnBids) &&
            canBid(state, this.rules, playerId)
            ? [...actions, PlaceBidsAction.type]
            : actions
    }
    enter(context: MachineContext<Hosted>): void {
        if (bidsAwaitSettlement(context.gameState)) context.addSystemAction(SettleBidBoxes, {})
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<Hosted>): string {
        if (action instanceof HydratedSettleBidBoxes)
            return context.gameState.phaseChange ? 'AdvancingPhase' : context.gameState.machineState
        if (action instanceof HydratedPlaceBids) return context.gameState.machineState
        // The boxes keep the turn's bid count and the round's settling, since the stock round's
        // records are every title's, and drop each as its turn or round ends, as share redemption
        // drops its refusals.
        if (isFinishStockTurn(action)) delete bidBoxesOf(context.gameState).turnBids
        if (isCompleteStockRound(action)) delete bidBoxesOf(context.gameState).settled
        return this.handler.onAction(action, context)
    }
}
