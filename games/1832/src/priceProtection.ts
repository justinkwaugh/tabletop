import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    PlayerAction,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import {
    CashPayment,
    StockMarketMove,
    SystemActionFirstHandler,
    copyStockState,
    finiteCashOwnedBy,
    getCompany,
    nextOperatingCompany,
    operatingPlayerIds,
    placeStockMarker,
    reorderPendingOperatingCompanies,
    settleCashPayments,
    sharesOwned,
    stockCertificateCount,
    type Owner,
    type ShareSaleDetails,
    type ShareSaleSettlement,
    type StockMarket,
    type StockState,
    stateWith
} from '@tabletop/18xx'
import {
    requireEighteenThirtyTwoState,
    type EighteenThirtyTwoState,
    type EighteenThirtyTwoStateHandler,
    type HydratedEighteenThirtyTwoState
} from './state.js'
import { ownershipCeiling } from './ownershipExcess.js'
import { EighteenThirtyTwoOperatingRules } from './roundRules.js'
import { EighteenThirtyTwoStockRules } from './stockRules.js'
import { EighteenThirtyTwoMarket, saleDescent } from './stockMarket.js'
import { MergingState, ProtectingPriceState, type ProtectableSale } from './titleState.js'

/** The company's president, when that is a player other than the seller. */
function presidentOtherThan(
    state: StockState,
    companyId: string,
    sellerPlayerId: string
): string | undefined {
    const company = getCompany(state, companyId)
    const president = company.president
    return !company.closed && president?.kind === 'player' && president.playerId !== sellerPlayerId
        ? president.playerId
        : undefined
}

/** The player president, other than the seller, who may buy back a sale of their company. */
export function protectingPresident(
    state: EighteenThirtyTwoState,
    sale: ProtectableSale
): string | undefined {
    const sellerPlayerId = state.priceProtection?.sellerPlayerId
    return sellerPlayerId ? presidentOtherThan(state, sale.companyId, sellerPlayerId) : undefined
}

function applyProtection(state: StockState, sale: ProtectableSale, playerId: string): CashPayment {
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

/**
 * A president may protect with the cash to buy every share sold and room for them under the
 * certificate limit at the price, which protecting keeps; the 60% limit does not apply (§5.9.3,
 * §5.9.5).
 */
function canProtect(state: StockState, sale: ProtectableSale, playerId: string) {
    if (finiteCashOwnedBy(state, { kind: 'player', playerId }) < sale.proceeds) return false
    const owner = { kind: 'player' as const, playerId }
    const before = stockCertificateCount(state, owner, EighteenThirtyTwoStockRules)
    const projected = copyStockState(state)
    applyProtection(projected, sale, playerId)
    const after = stockCertificateCount(projected, owner, EighteenThirtyTwoStockRules)
    return (
        after <= before || after <= EighteenThirtyTwoStockRules.certificateLimit(projected, owner)
    )
}

/** Whether a president other than the seller may still protect this sale. */
export function protectable(state: EighteenThirtyTwoState, sale: ProtectableSale): boolean {
    const playerId = protectingPresident(state, sale)
    return !!playerId && canProtect(state, sale, playerId)
}

/** The next sale, in the order sold, whose president may protect it, and that president. */
export function protectionDecision(
    state: EighteenThirtyTwoState
): { sale: ProtectableSale; playerId: string } | undefined {
    for (const sale of state.priceProtection?.sales ?? []) {
        const playerId = protectingPresident(state, sale)
        if (playerId && canProtect(state, sale, playerId)) return { sale, playerId }
    }
    return undefined
}

/**
 * Holds a player's sale, and their later sales of that company with it, until its president
 * decides (§5.9). A sale whose seller still presides over the company can never be protected,
 * so it moves at once: a company sold into the black closes immediately (§5.1.1, §10.6.2).
 * The president a sale leaves decides, so the state after the sale gives the same answer.
 */
export function holdsProtectableMove(
    state: StockState,
    sale: Pick<ShareSaleSettlement, 'companyId'>,
    seller: Owner
): boolean {
    if (seller.kind !== 'player') return false
    const held = requireEighteenThirtyTwoState(state).priceProtection?.sales
    return (
        !!held?.some((entry) => entry.companyId === sale.companyId) ||
        !!presidentOtherThan(state, sale.companyId, seller.playerId)
    )
}

/** Records a player's held sales for their presidents to decide once the seller finishes. */
export function recordProtectableSale(state: object, details: ShareSaleDetails): void {
    const title = requireEighteenThirtyTwoState(state)
    const seller = details.seller
    const held = details.sales.filter((sale) => holdsProtectableMove(title, sale, seller))
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

// Records stored before sales were held have no blocks: their prices already fell.
function saleBlocks(sale: ProtectableSale): readonly number[] {
    return sale.blocks ?? []
}

/**
 * Moves held sales' markers down as their sales would have, sale by sale in the order sold, each
 * stopping on the soft ledge as it would and arriving below the markers already there (§5.8.1,
 * §5.8.4).
 */
function fallHeldSales(market: StockMarket, sales: readonly ProtectableSale[]): StockMarketMove[] {
    return sales.map((sale) => {
        const from = EighteenThirtyTwoMarket.companySpace(market, sale.companyId).id
        for (const shares of saleBlocks(sale)) {
            const space = EighteenThirtyTwoMarket.companySpace(market, sale.companyId).id
            const to = EighteenThirtyTwoMarket.move(space, 'down', saleDescent(space, shares))
            placeStockMarker(market, sale.companyId, to.id)
        }
        const to = EighteenThirtyTwoMarket.companySpace(market, sale.companyId).id
        return { companyId: sale.companyId, fromMarketSpaceId: from, toMarketSpaceId: to }
    })
}

/** Where a held sale's price falls if its president declines to protect it (§5.8.2). */
export function declinedMarketSpaceId(state: StockState, sale: ProtectableSale): string {
    const stockMarket = structuredClone(state.stockMarket)
    const [move] = fallHeldSales(stockMarket, [sale])
    return move.toMarketSpaceId
}

/**
 * The state the seller's holding limits read while their sales are held: as no president will
 * protect them, with every held price fallen (§5.3.5, §5.9).
 */
export function sellerLimitState<State extends StockState>(state: State, owner: Owner): State {
    const record = requireEighteenThirtyTwoState(state).priceProtection
    if (
        !record?.sales.length ||
        record.resume ||
        owner.kind !== 'player' ||
        owner.playerId !== record.sellerPlayerId
    )
        return state
    const stockMarket = structuredClone(state.stockMarket)
    fallHeldSales(stockMarket, record.sales)
    return stateWith(state, { stockMarket })
}

/**
 * Drops declined sales and those no president can protect; prices that fell take their
 * companies' places in the operating order (§4.1.3).
 */
function dropSales(
    state: HydratedEighteenThirtyTwoState,
    sales: readonly ProtectableSale[]
): StockMarketMove[] {
    const moves = fallHeldSales(state.stockMarket, sales)
    if (moves.length)
        reorderPendingOperatingCompanies(state, EighteenThirtyTwoOperatingRules.companyOrder(state))
    return moves
}

function leadingUnprotectableSales(state: HydratedEighteenThirtyTwoState): ProtectableSale[] {
    const record = state.priceProtection
    assertExists(record, 'Held sales await their decisions')
    const index = record.sales.findIndex((sale) => protectable(state, sale))
    return record.sales.splice(0, index === -1 ? record.sales.length : index)
}

const MarketMoveList = Type.Array(StockMarketMove, { minItems: 1 })
const MarketMoves = Type.Optional(MarketMoveList)
function withMoves(moves: StockMarketMove[]) {
    return moves.length ? { marketMoves: moves } : {}
}

// A seller finishes when their stock turn passes on, or their train or takeover is paid for.
function sellerFinished(state: HydratedEighteenThirtyTwoState, sellerPlayerId: string): boolean {
    return state.machineState === 'StockRound'
        ? state.turnManager.currentTurn()?.playerId !== sellerPlayerId
        : !state.trainFunding && !state.mergerPhase?.funding
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

/**
 * Once the seller finishes, drops the sales no president can protect and sets play aside for
 * the presidents' decisions on the rest.
 */
export class HydratedStartPriceProtection
    extends HydratableAction<typeof StartPriceProtection>
    implements StartPriceProtection
{
    declare type: 'StartPriceProtection'
    declare metadata?: StartPriceProtection['metadata']
    constructor(data: StartPriceProtection) {
        super(
            data instanceof HydratedStartPriceProtection ? data.dehydrate() : data,
            StartValidator
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        const record = state.priceProtection
        assert(
            this.source === ActionSource.System &&
                record &&
                !record.resume &&
                sellerFinished(state, record.sellerPlayerId),
            'Price protection starts once the seller finishes'
        )
        const moves = dropSales(state, leadingUnprotectableSales(state))
        const protectable = record.sales.length > 0
        if (protectable) record.resume = { machineState: state.machineState }
        else delete state.priceProtection
        this.metadata = { protectable, ...withMoves(moves) }
    }
}

const DecisionFields = {
    ...PlayerAction.properties,
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

function isCurrentDecision(
    state: EighteenThirtyTwoState,
    action: { source?: ActionSource; playerId: string; companyId: string }
): boolean {
    const decision = protectionDecision(state)
    return (
        state.machineState === ProtectingPriceState &&
        action.source === ActionSource.User &&
        decision?.playerId === action.playerId &&
        decision.sale.companyId === action.companyId
    )
}

function decided(state: HydratedEighteenThirtyTwoState, companyId: string) {
    const record = state.priceProtection
    assertExists(record, 'A protection decision requires sales awaiting it')
    record.sales = record.sales.filter((sale) => sale.companyId !== companyId)
    return record
}

/**
 * The president buys every share of the company the seller sold at the price they fetched, and
 * the price stays where it stood, as if the sale never took place (§5.9, §5.9.3). They keep any
 * holding above 60% until they next sell shares of the company (§5.9.8).
 */
export class HydratedProtectShares
    extends HydratableAction<typeof ProtectShares>
    implements ProtectShares
{
    declare type: 'ProtectShares'
    declare playerId: string
    declare companyId: string
    declare metadata?: ProtectShares['metadata']
    constructor(data: ProtectShares) {
        super(data instanceof HydratedProtectShares ? data.dehydrate() : data, ProtectValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return isCurrentDecision(state, this)
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'Only the deciding president may protect this sale')
        const sale = protectionDecision(state)?.sale
        assertExists(sale, 'A valid protection has its sale')
        const record = state.priceProtection
        assertExists(record, 'A protection decision requires sales awaiting it')
        const payment = applyProtection(state, sale, this.playerId)
        const exemptOwnershipLimit =
            sharesOwned(state, this.companyId, { kind: 'player', playerId: this.playerId }) >
            ownershipCeiling(state, this.companyId)
        decided(state, this.companyId)
        record.lastProtectorId = this.playerId
        const moves = dropSales(state, leadingUnprotectableSales(state))
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

/** The sale reaches the market: its price falls as the sale's would have (§5.8.2). */
export class HydratedDeclineProtection
    extends HydratableAction<typeof DeclineProtection>
    implements DeclineProtection
{
    declare type: 'DeclineProtection'
    declare playerId: string
    declare companyId: string
    declare metadata?: DeclineProtection['metadata']
    constructor(data: DeclineProtection) {
        super(data instanceof HydratedDeclineProtection ? data.dehydrate() : data, DeclineValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return isCurrentDecision(state, this)
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'Only the deciding president may decline this sale')
        const sale = protectionDecision(state)?.sale
        assertExists(sale, 'A valid decline has its sale')
        decided(state, this.companyId)
        this.metadata = {
            marketMoves: dropSales(state, [sale, ...leadingUnprotectableSales(state)])
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

/**
 * The players play returns to when no stock round turn is skipped: the stock round's player
 * whose turn is under way, none in a merger phase, which names its next decision on entry, and
 * otherwise the operators of the company the seller was operating.
 */
function resumedPlayerIds(state: HydratedEighteenThirtyTwoState, machineState: string): string[] {
    if (machineState === 'StockRound') {
        const turn = state.turnManager.currentTurn()
        assertExists(turn, 'The stock round has a turn under way')
        return [turn.playerId]
    }
    if (machineState === MergingState) return []
    const companyId = nextOperatingCompany(state)
    assertExists(companyId, 'Play resumes with an operating company')
    return operatingPlayerIds(state, companyId)
}

/**
 * Returns play to where the sale left it. In a stock round with a protection, play passes to
 * the left of the president whose shares were sold last, which may skip players (§5.9.6-5.9.7).
 */
export class HydratedCompletePriceProtection
    extends HydratableAction<typeof CompletePriceProtection>
    implements CompletePriceProtection
{
    declare type: 'CompletePriceProtection'
    declare metadata?: CompletePriceProtection['metadata']
    constructor(data: CompletePriceProtection) {
        super(
            data instanceof HydratedCompletePriceProtection ? data.dehydrate() : data,
            CompleteValidator
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        const record = state.priceProtection
        assert(
            this.source === ActionSource.System && record?.resume && !protectionDecision(state),
            'Price protection completes once no president has a decision left'
        )
        const { machineState } = record.resume
        const lastProtector = record.lastProtectorId
        let nextPlayerId: string | undefined
        if (machineState === 'StockRound' && lastProtector) {
            nextPlayerId = state.turnManager.nextPlayer(lastProtector)
            const turn = state.turnManager.currentTurn()
            assertExists(turn, 'The stock round has a turn under way')
            // Players between the seller and the protector miss their turn.
            if (turn.playerId !== nextPlayerId) {
                state.turnManager.endTurn(state.actionCount)
                state.turnManager.startTurn(nextPlayerId, state.actionCount + 1)
            }
            state.activePlayerIds = [nextPlayerId]
            state.stockRound.passedPlayerIds = []
        } else {
            state.activePlayerIds = resumedPlayerIds(state, machineState)
        }
        delete state.priceProtection
        this.metadata = { machineState, ...(nextPlayerId ? { nextPlayerId } : {}) }
    }
}

/** Presidents decide, in the order the shares were sold, whether to protect each sale (§5.9). */
export class ProtectingPriceHandler implements EighteenThirtyTwoStateHandler {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): boolean {
        const state = context.gameState
        if (action instanceof HydratedProtectShares || action instanceof HydratedDeclineProtection)
            return action.isValid(state)
        return (
            action instanceof HydratedCompletePriceProtection &&
            action.source === ActionSource.System &&
            !protectionDecision(state)
        )
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): string[] {
        return protectionDecision(context.gameState)?.playerId === playerId
            ? ['ProtectShares', 'DeclineProtection']
            : []
    }
    enter(context: MachineContext<HydratedEighteenThirtyTwoState>): void {
        const decision = protectionDecision(context.gameState)
        if (decision) context.gameState.activePlayerIds = [decision.playerId]
        else context.addSystemAction(CompletePriceProtection, {})
    }
    onAction(action: HydratedAction): string {
        if (!(action instanceof HydratedCompletePriceProtection)) return ProtectingPriceState
        assertExists(action.metadata, 'A completed protection records where play resumes')
        return action.metadata.machineState
    }
}

/** Hands sales to their presidents once the seller has finished selling (§5.9.2). */
export function startsPriceProtection(
    handler: EighteenThirtyTwoStateHandler
): EighteenThirtyTwoStateHandler {
    return new SystemActionFirstHandler(
        handler,
        StartPriceProtection,
        (state) => {
            const record = state.priceProtection
            return record && !record.resume && sellerFinished(state, record.sellerPlayerId)
                ? {}
                : undefined
        },
        (state) => (state.priceProtection ? ProtectingPriceState : state.machineState)
    )
}
