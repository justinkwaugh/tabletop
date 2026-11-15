import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, getCompany, sharesOwned, type Owner } from '../finance/finance.js'
import { operatingPlayerIds } from '../finance/receivership.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { stateWith } from '../game/stateWith.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import {
    nextOperatingCompany,
    reorderPendingOperatingCompanies
} from '../operating/operatingSet.js'
import type { OperatingState } from '../operating/operatingSet.js'
import type { ShareSaleDetails, ShareSaleSettlement } from './shareSale.js'
import type { SoftLedgeMarket } from './softLedgeMarket.js'
import { placeStockMarker, StockMarketMove, type StockMarket } from './stockMarket.js'
import { stockCertificateCount, type StockRules } from './stockRules.js'
import { copyStockState, type StockState } from './stockState.js'

const Id = Type.String({ minLength: 1 })

export const ProtectingPriceState = 'ProtectingPrice'

export const ProtectableSale = Type.Object(
    {
        companyId: Id,
        shares: Type.Integer({ minimum: 1 }),
        proceeds: Type.Integer({ minimum: 1 }),
        certificateIds: Type.Array(Id, { minItems: 1 }),
        fromMarketSpaceId: Id,
        /**
         * Each sale's shares, in the order sold; unprotected, the marker falls sale by sale.
         * Records stored before sales were held have none, their prices having already fallen.
         */
        blocks: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1 }))
    },
    { additionalProperties: false }
)
export type ProtectableSale = Type.Static<typeof ProtectableSale>

export const PriceProtection = Type.Object(
    {
        sellerPlayerId: Id,
        sales: Type.Array(ProtectableSale),
        // Stored games from before sales were held may hold it; never read.
        stacks: Type.Optional(
            Type.Unsafe<never>(
                Type.Array(
                    Type.Object(
                        { spaceId: Id, companyIds: Type.Array(Id) },
                        { additionalProperties: false }
                    )
                )
            )
        ),
        lastProtectorId: Type.Optional(Id),
        resume: Type.Optional(Type.Object({ machineState: Id }, { additionalProperties: false }))
    },
    { additionalProperties: false }
)
export type PriceProtection = Type.Static<typeof PriceProtection>

export const PriceProtectionFields = { priceProtection: Type.Optional(PriceProtection) }
export type PriceProtectionState = Type.Static<Type.TObject<typeof PriceProtectionFields>>

type ProtectionState = HydratedEighteenXXState & PriceProtectionState

export interface PriceProtectionRules<State extends ProtectionState> {
    market: Pick<SoftLedgeMarket, 'chart' | 'saleDescent'>
    stockRules(): StockRules
    companyOrder(state: OperatingState): string[]
    requireState(state: object): State
    ownershipCeiling(state: StockState, companyId: string): number
    /**
     * A sale that passes the presidency leaves the new president to decide (1832); otherwise only
     * the president before the sale could have protected it, and the seller cannot (1870).
     */
    newPresidentProtects: boolean
    /** Whether a president may protect at all, as 1870 bars one who sold it this stock round. */
    mayProtect?(state: State, companyId: string, playerId: string): boolean
    /** A seller still raising money beyond a train's funding, as for 1832's takeovers. */
    sellerStillRaising?(state: State): boolean
    /** Decision states that name their next decision on entry, so resume with no players. */
    resumesWithoutPlayers?: readonly string[]
}

const MarketMoveList = Type.Array(StockMarketMove, { minItems: 1 })
const MarketMoves = Type.Optional(MarketMoveList)
function withMoves(moves: StockMarketMove[]) {
    return moves.length ? { marketMoves: moves } : {}
}
const saleBlocks = (sale: ProtectableSale): readonly number[] => sale.blocks ?? []

export class PriceProtectionProcedure<State extends ProtectionState> {
    constructor(readonly rules: PriceProtectionRules<State>) {}

    private presidentOtherThan(
        state: StockState,
        companyId: string,
        sellerPlayerId: string
    ): string | undefined {
        const company = getCompany(state, companyId)
        const president = company.president
        return !company.closed &&
            president?.kind === 'player' &&
            president.playerId !== sellerPlayerId
            ? president.playerId
            : undefined
    }

    protectingPresident(state: State, sale: ProtectableSale): string | undefined {
        const sellerPlayerId = state.priceProtection?.sellerPlayerId
        return sellerPlayerId
            ? this.presidentOtherThan(state, sale.companyId, sellerPlayerId)
            : undefined
    }

    private applyProtection(
        state: StockState,
        sale: ProtectableSale,
        playerId: string
    ): CashPayment {
        const payment: CashPayment = {
            from: { kind: 'player', playerId },
            to: { kind: 'bank' },
            amount: sale.proceeds
        }
        settleCashPayments(state, [payment])
        for (const id of sale.certificateIds) {
            const certificate = state.certificates.find((item) => item.id === id)
            assert(
                certificate &&
                    certificate.owner.kind === 'bank' &&
                    certificate.poolId === 'open-market',
                'Protected shares are bought back from the open market'
            )
            certificate.owner = { kind: 'player', playerId }
            delete certificate.poolId
        }
        return payment
    }

    private canProtect(state: State, sale: ProtectableSale, playerId: string): boolean {
        if (this.rules.mayProtect?.(state, sale.companyId, playerId) === false) return false
        if (finiteCashOwnedBy(state, { kind: 'player', playerId }) < sale.proceeds) return false
        const owner = { kind: 'player' as const, playerId }
        const stockRules = this.rules.stockRules()
        const before = stockCertificateCount(state, owner, stockRules)
        const projected = copyStockState(state)
        this.applyProtection(projected, sale, playerId)
        const after = stockCertificateCount(projected, owner, stockRules)
        return after <= before || after <= stockRules.certificateLimit(projected, owner)
    }

    protectable(state: State, sale: ProtectableSale): boolean {
        const playerId = this.protectingPresident(state, sale)
        return !!playerId && this.canProtect(state, sale, playerId)
    }

    decision(state: State): { sale: ProtectableSale; playerId: string } | undefined {
        for (const sale of state.priceProtection?.sales ?? []) {
            const playerId = this.protectingPresident(state, sale)
            if (playerId && this.canProtect(state, sale, playerId)) return { sale, playerId }
        }
        return undefined
    }

    holdsMove(
        state: StockState,
        sale: Pick<ShareSaleSettlement, 'companyId' | 'presidency'>,
        seller: Owner
    ): boolean {
        if (seller.kind !== 'player') return false
        const held = this.rules.requireState(state).priceProtection?.sales
        if (held?.some((entry) => entry.companyId === sale.companyId)) return true
        if (sale.presidency && !this.rules.newPresidentProtects) return false
        return !!this.presidentOtherThan(state, sale.companyId, seller.playerId)
    }

    recordSale(state: object, details: ShareSaleDetails): void {
        const title = this.rules.requireState(state)
        const seller = details.seller
        const held = details.sales.filter((sale) => this.holdsMove(title, sale, seller))
        if (seller.kind !== 'player' || !held.length) return
        const record = title.priceProtection
        assert(
            !record || (record.sellerPlayerId === seller.playerId && !record.resume),
            'Sales await protection only while their seller is selling'
        )
        let sales = record?.sales ?? []
        for (const sale of held) {
            const group = sales.find((entry) => entry.companyId === sale.companyId)
            sales = group
                ? sales.map((entry) =>
                      entry === group
                          ? {
                                ...entry,
                                shares: entry.shares + sale.shares,
                                proceeds: entry.proceeds + sale.proceeds,
                                certificateIds: [...entry.certificateIds, ...sale.certificateIds],
                                blocks: [...saleBlocks(entry), sale.shares]
                            }
                          : entry
                  )
                : [
                      ...sales,
                      {
                          companyId: sale.companyId,
                          shares: sale.shares,
                          proceeds: sale.proceeds,
                          certificateIds: sale.certificateIds,
                          fromMarketSpaceId: sale.fromMarketSpaceId,
                          blocks: [sale.shares]
                      }
                  ]
        }
        title.priceProtection = { sellerPlayerId: seller.playerId, sales }
    }

    private fallHeldSales(
        stockMarket: StockMarket,
        sales: readonly ProtectableSale[]
    ): StockMarketMove[] {
        const market = this.rules.market.chart
        return sales.map((sale) => {
            const from = market.companySpace(stockMarket, sale.companyId).id
            for (const shares of saleBlocks(sale)) {
                const space = market.companySpace(stockMarket, sale.companyId).id
                const descent = this.rules.market.saleDescent(space, shares)
                placeStockMarker(
                    stockMarket,
                    sale.companyId,
                    market.move(space, 'down', descent).id
                )
            }
            const to = market.companySpace(stockMarket, sale.companyId).id
            return { companyId: sale.companyId, fromMarketSpaceId: from, toMarketSpaceId: to }
        })
    }

    declinedMarketSpaceId(state: StockState, sale: ProtectableSale): string {
        const stockMarket = structuredClone(state.stockMarket)
        const [move] = this.fallHeldSales(stockMarket, [sale])
        return move.toMarketSpaceId
    }

    sellerLimitState<Limits extends StockState>(state: Limits, owner: Owner): Limits {
        const record = this.rules.requireState(state).priceProtection
        if (
            !record?.sales.length ||
            record.resume ||
            owner.kind !== 'player' ||
            owner.playerId !== record.sellerPlayerId
        )
            return state
        const stockMarket = structuredClone(state.stockMarket)
        this.fallHeldSales(stockMarket, record.sales)
        return stateWith(state, { stockMarket })
    }

    dropSales(state: State, sales: readonly ProtectableSale[]): StockMarketMove[] {
        const moves = this.fallHeldSales(state.stockMarket, sales)
        if (moves.length) reorderPendingOperatingCompanies(state, this.rules.companyOrder(state))
        return moves
    }

    leadingUnprotectableSales(state: State): ProtectableSale[] {
        const record = state.priceProtection
        assertExists(record, 'Held sales await their decisions')
        const index = record.sales.findIndex((sale) => this.protectable(state, sale))
        return record.sales.splice(0, index === -1 ? record.sales.length : index)
    }

    sellerFinished(state: State, sellerPlayerId: string): boolean {
        return state.machineState === 'StockRound'
            ? state.turnManager.currentTurn()?.playerId !== sellerPlayerId
            : !!state.bankruptcy || (!state.trainFunding && !this.rules.sellerStillRaising?.(state))
    }

    isCurrentDecision(
        state: State,
        action: { source?: ActionSource; playerId: string; companyId: string }
    ): boolean {
        const decision = this.decision(state)
        return (
            state.machineState === ProtectingPriceState &&
            action.source === ActionSource.User &&
            decision?.playerId === action.playerId &&
            decision.sale.companyId === action.companyId
        )
    }

    protect(state: State, sale: ProtectableSale, playerId: string) {
        const payment = this.applyProtection(state, sale, playerId)
        const exemptOwnershipLimit =
            sharesOwned(state, sale.companyId, { kind: 'player', playerId }) >
            this.rules.ownershipCeiling(state, sale.companyId)
        return { payment, exemptOwnershipLimit }
    }

    resumedPlayerIds(state: State, machineState: string): string[] {
        if (machineState === 'StockRound') {
            const turn = state.turnManager.currentTurn()
            assertExists(turn, 'The stock round has a turn under way')
            return [turn.playerId]
        }
        if (this.rules.resumesWithoutPlayers?.includes(machineState)) return []
        const companyId = nextOperatingCompany(state)
        assertExists(companyId, 'Play resumes with an operating company')
        return operatingPlayerIds(state, companyId)
    }

    actions(): ActionDefinition[] {
        return [
            defineAction(
                StartPriceProtection,
                isStartPriceProtection,
                (action) => new HydratedStartPriceProtection(action, this)
            ),
            defineAction(
                ProtectShares,
                isProtectShares,
                (action) => new HydratedProtectShares(action, this)
            ),
            defineAction(
                DeclineProtection,
                isDeclineProtection,
                (action) => new HydratedDeclineProtection(action, this)
            ),
            defineAction(
                CompletePriceProtection,
                isCompletePriceProtection,
                (action) => new HydratedCompletePriceProtection(action, this)
            )
        ]
    }

    starts(handler: EighteenXXStateHandler<State>): EighteenXXStateHandler<State> {
        return new SystemActionFirstHandler(
            handler,
            StartPriceProtection,
            (state) => {
                const record = state.priceProtection
                return record && !record.resume && this.sellerFinished(state, record.sellerPlayerId)
                    ? {}
                    : undefined
            },
            (state) => (state.priceProtection ? ProtectingPriceState : state.machineState)
        )
    }

    handler(): EighteenXXStateHandler<State> {
        return new ProtectingPriceHandler(this)
    }
}

const StartFields = Type.Object({
    type: Type.Literal('StartPriceProtection'),
    metadata: Type.Optional(
        Type.Object(
            { protectable: Type.Boolean(), marketMoves: MarketMoves },
            { additionalProperties: false }
        )
    )
})
export const StartPriceProtection: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof StartFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartFields.properties },
    { additionalProperties: false }
)
export type StartPriceProtection = Type.Static<typeof StartPriceProtection>
const StartValidator = Compile(StartPriceProtection)
export function isStartPriceProtection(action: GameAction): action is StartPriceProtection {
    return (
        action instanceof HydratedStartPriceProtection ||
        (action.type === 'StartPriceProtection' && StartValidator.Check(action))
    )
}

export class HydratedStartPriceProtection<State extends ProtectionState = ProtectionState>
    extends HydratableAction<typeof StartPriceProtection>
    implements StartPriceProtection
{
    declare type: 'StartPriceProtection'
    declare metadata?: StartPriceProtection['metadata']
    readonly #procedure: PriceProtectionProcedure<State>
    constructor(data: StartPriceProtection, procedure: PriceProtectionProcedure<State>) {
        super(
            data instanceof HydratedStartPriceProtection ? data.dehydrate() : data,
            StartValidator
        )
        this.#procedure = procedure
    }
    apply(state: State): void {
        const record = state.priceProtection
        assert(
            this.source === ActionSource.System &&
                record &&
                !record.resume &&
                this.#procedure.sellerFinished(state, record.sellerPlayerId),
            'Price protection starts once the seller finishes'
        )
        const moves = this.#procedure.dropSales(
            state,
            this.#procedure.leadingUnprotectableSales(state)
        )
        const protectable = record.sales.length > 0
        if (protectable) record.resume = { machineState: state.machineState }
        else delete state.priceProtection
        this.metadata = { protectable, ...withMoves(moves) }
    }
}

const DecisionFields = {
    ...EighteenXXPlayerAction.properties,
    companyId: Type.String()
}
export const ProtectShares = Type.Object(
    {
        ...DecisionFields,
        type: Type.Literal('ProtectShares'),
        metadata: Type.Optional(
            Type.Object(
                {
                    sellerPlayerId: Type.String(),
                    shares: Type.Integer({ minimum: 1 }),
                    payment: CashPayment,
                    // Stored protections from before sales were held may hold it; never read.
                    restoredMarketSpaceId: Type.Optional(Type.Unsafe<never>(Type.String())),
                    exemptOwnershipLimit: Type.Boolean(),
                    marketMoves: MarketMoves
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type ProtectShares = Type.Static<typeof ProtectShares>
const ProtectValidator = Compile(ProtectShares)
export function isProtectShares(action: GameAction): action is ProtectShares {
    return (
        action instanceof HydratedProtectShares ||
        (action.type === 'ProtectShares' && ProtectValidator.Check(action))
    )
}

function decided(state: PriceProtectionState, companyId: string): PriceProtection {
    const record = state.priceProtection
    assertExists(record, 'A protection decision requires sales awaiting it')
    record.sales = record.sales.filter((sale) => sale.companyId !== companyId)
    return record
}

export class HydratedProtectShares<State extends ProtectionState = ProtectionState>
    extends HydratableAction<typeof ProtectShares>
    implements ProtectShares
{
    declare type: 'ProtectShares'
    declare playerId: string
    declare companyId: string
    declare metadata?: ProtectShares['metadata']
    readonly #procedure: PriceProtectionProcedure<State>
    constructor(data: ProtectShares, procedure: PriceProtectionProcedure<State>) {
        super(data instanceof HydratedProtectShares ? data.dehydrate() : data, ProtectValidator)
        this.#procedure = procedure
    }
    isValid(state: State): boolean {
        return this.#procedure.isCurrentDecision(state, this)
    }
    apply(state: State): void {
        assert(this.isValid(state), 'Only the deciding president may protect this sale')
        const sale = this.#procedure.decision(state)?.sale
        assertExists(sale, 'A valid protection has its sale')
        const record = state.priceProtection
        assertExists(record, 'A protection decision requires sales awaiting it')
        const { payment, exemptOwnershipLimit } = this.#procedure.protect(
            state,
            sale,
            this.playerId
        )
        decided(state, this.companyId)
        record.lastProtectorId = this.playerId
        const moves = this.#procedure.dropSales(
            state,
            this.#procedure.leadingUnprotectableSales(state)
        )
        this.metadata = {
            sellerPlayerId: record.sellerPlayerId,
            shares: sale.shares,
            payment,
            exemptOwnershipLimit,
            ...withMoves(moves)
        }
    }
}

export const DeclineProtection = Type.Object(
    {
        ...DecisionFields,
        type: Type.Literal('DeclineProtection'),
        metadata: Type.Optional(
            Type.Object({ marketMoves: MarketMoveList }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type DeclineProtection = Type.Static<typeof DeclineProtection>
const DeclineValidator = Compile(DeclineProtection)
export function isDeclineProtection(action: GameAction): action is DeclineProtection {
    return (
        action instanceof HydratedDeclineProtection ||
        (action.type === 'DeclineProtection' && DeclineValidator.Check(action))
    )
}

export class HydratedDeclineProtection<State extends ProtectionState = ProtectionState>
    extends HydratableAction<typeof DeclineProtection>
    implements DeclineProtection
{
    declare type: 'DeclineProtection'
    declare playerId: string
    declare companyId: string
    declare metadata?: DeclineProtection['metadata']
    readonly #procedure: PriceProtectionProcedure<State>
    constructor(data: DeclineProtection, procedure: PriceProtectionProcedure<State>) {
        super(data instanceof HydratedDeclineProtection ? data.dehydrate() : data, DeclineValidator)
        this.#procedure = procedure
    }
    isValid(state: State): boolean {
        return this.#procedure.isCurrentDecision(state, this)
    }
    apply(state: State): void {
        assert(this.isValid(state), 'Only the deciding president may decline this sale')
        const sale = this.#procedure.decision(state)?.sale
        assertExists(sale, 'A valid decline has its sale')
        decided(state, this.companyId)
        this.metadata = {
            marketMoves: this.#procedure.dropSales(state, [
                sale,
                ...this.#procedure.leadingUnprotectableSales(state)
            ])
        }
    }
}

const CompleteFields = Type.Object({
    type: Type.Literal('CompletePriceProtection'),
    metadata: Type.Optional(
        Type.Object(
            { machineState: Type.String(), nextPlayerId: Type.Optional(Type.String()) },
            { additionalProperties: false }
        )
    )
})
export const CompletePriceProtection: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof CompleteFields.properties
> = Type.Object(
    { ...GameAction.properties, ...CompleteFields.properties },
    { additionalProperties: false }
)
export type CompletePriceProtection = Type.Static<typeof CompletePriceProtection>
const CompleteValidator = Compile(CompletePriceProtection)
export function isCompletePriceProtection(action: GameAction): action is CompletePriceProtection {
    return (
        action instanceof HydratedCompletePriceProtection ||
        (action.type === 'CompletePriceProtection' && CompleteValidator.Check(action))
    )
}

export class HydratedCompletePriceProtection<State extends ProtectionState = ProtectionState>
    extends HydratableAction<typeof CompletePriceProtection>
    implements CompletePriceProtection
{
    declare type: 'CompletePriceProtection'
    declare metadata?: CompletePriceProtection['metadata']
    readonly #procedure: PriceProtectionProcedure<State>
    constructor(data: CompletePriceProtection, procedure: PriceProtectionProcedure<State>) {
        super(
            data instanceof HydratedCompletePriceProtection ? data.dehydrate() : data,
            CompleteValidator
        )
        this.#procedure = procedure
    }
    apply(state: State): void {
        const record = state.priceProtection
        assert(
            this.source === ActionSource.System &&
                record?.resume &&
                !this.#procedure.decision(state),
            'Price protection completes once no president has a decision left'
        )
        const { machineState } = record.resume
        const lastProtector = record.lastProtectorId
        let nextPlayerId: string | undefined
        if (machineState === 'StockRound' && lastProtector) {
            nextPlayerId = state.turnManager.nextPlayer(lastProtector)
            const turn = state.turnManager.currentTurn()
            assertExists(turn, 'The stock round has a turn under way')
            if (turn.playerId !== nextPlayerId) {
                state.turnManager.endTurn(state.actionCount)
                state.turnManager.startTurn(nextPlayerId, state.actionCount + 1)
            }
            state.activePlayerIds = [nextPlayerId]
            state.stockRound.passedPlayerIds = []
        } else {
            state.activePlayerIds = this.#procedure.resumedPlayerIds(state, machineState)
        }
        delete state.priceProtection
        this.metadata = { machineState, ...(nextPlayerId ? { nextPlayerId } : {}) }
    }
}

class ProtectingPriceHandler<
    State extends ProtectionState
> implements EighteenXXStateHandler<State> {
    constructor(private readonly procedure: PriceProtectionProcedure<State>) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (action instanceof HydratedProtectShares || action instanceof HydratedDeclineProtection)
            return this.procedure.isCurrentDecision(state, {
                source: action.source,
                playerId: action.playerId,
                companyId: action.companyId
            })
        return (
            action instanceof HydratedCompletePriceProtection &&
            action.source === ActionSource.System &&
            !this.procedure.decision(state)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return this.procedure.decision(context.gameState)?.playerId === playerId
            ? ['ProtectShares', 'DeclineProtection']
            : []
    }
    enter(context: MachineContext<State>): void {
        const decision = this.procedure.decision(context.gameState)
        if (decision) context.gameState.activePlayerIds = [decision.playerId]
        else context.addSystemAction(CompletePriceProtection, {})
    }
    onAction(action: HydratedAction): string {
        if (!(action instanceof HydratedCompletePriceProtection)) return ProtectingPriceState
        assertExists(action.metadata, 'A completed protection records where play resumes')
        return action.metadata.machineState
    }
}
