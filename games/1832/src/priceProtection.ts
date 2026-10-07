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
    SystemActionFirstHandler,
    copyStockState,
    finiteCashOwnedBy,
    getCompany,
    reorderPendingOperatingCompanies,
    restoreStockMarker,
    sameOwner,
    settleCashPayments,
    stockCertificateCount,
    type ShareSaleDetails,
    type StockState
} from '@tabletop/18xx'
import {
    requireEighteenThirtyTwoState,
    type EighteenThirtyTwoState,
    type EighteenThirtyTwoStateHandler,
    type HydratedEighteenThirtyTwoState
} from './state.js'
import { refreshOwnershipExcess } from './ownershipExcess.js'
import { EighteenThirtyTwoOperatingRules } from './roundRules.js'
import { EighteenThirtyTwoStockRules } from './stockRules.js'
import { ProtectingPriceState, type ProtectableSale } from './titleState.js'

type SaleRecord = NonNullable<EighteenThirtyTwoState['priceProtection']>
type StackSnapshot = SaleRecord['stacks'][number]

/**
 * Records a player's sales for their presidents to protect once the seller finishes, with each
 * space's stack as it stood before the seller's first sale from it (§5.9.3).
 */
export function recordProtectableSale(state: object, details: ShareSaleDetails): void {
    const title = requireEighteenThirtyTwoState(state)
    const seller = details.seller
    if (seller.kind !== 'player') return
    const record = title.priceProtection
    assert(
        !record || (record.sellerPlayerId === seller.playerId && !record.resume),
        'Sales await protection only while their seller is selling'
    )
    let sales = record?.sales ?? []
    let stacks = record?.stacks ?? []
    for (const sale of details.sales) {
        const fromStackIndex = sale.fromStackIndex
        assertExists(fromStackIndex, 'A market sale records its place in the stack')
        if (!stacks.some((stack) => stack.spaceId === sale.fromMarketSpaceId)) {
            const remaining =
                title.stockMarket.stacks.find((stack) => stack.spaceId === sale.fromMarketSpaceId)
                    ?.companyIds ?? []
            const companyIds = remaining.filter((companyId) => companyId !== sale.companyId)
            companyIds.splice(fromStackIndex, 0, sale.companyId)
            stacks = [...stacks, { spaceId: sale.fromMarketSpaceId, companyIds }]
        }
        const group = sales.find((entry) => entry.companyId === sale.companyId)
        sales = group
            ? sales.map((entry) =>
                  entry === group
                      ? {
                            ...entry,
                            shares: entry.shares + sale.shares,
                            proceeds: entry.proceeds + sale.proceeds,
                            certificateIds: [...entry.certificateIds, ...sale.certificateIds]
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
                      fromStackIndex
                  }
              ]
    }
    title.priceProtection = { sellerPlayerId: seller.playerId, sales, stacks, protectorIds: [] }
}

/** The player president, other than the seller, who may buy back a sale of their company. */
export function protectingPresident(
    state: EighteenThirtyTwoState,
    sale: ProtectableSale
): string | undefined {
    const company = getCompany(state, sale.companyId)
    const president = company.president
    return !company.closed &&
        president?.kind === 'player' &&
        president.playerId !== state.priceProtection?.sellerPlayerId
        ? president.playerId
        : undefined
}

// The marker returns among the companies still in its space as they stood before the seller's
// sales, so protecting two companies from one space keeps their order.
function restoredStackIndex(state: StockState, sale: ProtectableSale, stacks: StackSnapshot[]) {
    const before = stacks.find((stack) => stack.spaceId === sale.fromMarketSpaceId)?.companyIds
    assertExists(before, 'A protected sale records its stack')
    const above = before.slice(0, before.indexOf(sale.companyId))
    const present =
        state.stockMarket.stacks.find((stack) => stack.spaceId === sale.fromMarketSpaceId)
            ?.companyIds ?? []
    return present.filter((companyId) => above.includes(companyId)).length
}

function applyProtection(
    state: StockState,
    sale: ProtectableSale,
    playerId: string,
    stacks: StackSnapshot[]
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
                !certificate.retired &&
                certificate.owner.kind === 'bank' &&
                certificate.poolId === 'open-market',
            'Protected shares are bought back from the open market'
        )
        certificate.owner = { kind: 'player', playerId }
        delete certificate.poolId
    }
    restoreStockMarker(
        state.stockMarket,
        sale.companyId,
        sale.fromMarketSpaceId,
        restoredStackIndex(state, sale, stacks)
    )
    return payment
}

/**
 * A president may protect with the cash to buy every share sold and room for them under the
 * certificate limit at the restored price; the 60% limit does not apply (§5.9.3, §5.9.5).
 */
function canProtect(state: EighteenThirtyTwoState, sale: ProtectableSale, playerId: string) {
    if (finiteCashOwnedBy(state, { kind: 'player', playerId }) < sale.proceeds) return false
    const owner = { kind: 'player' as const, playerId }
    const before = stockCertificateCount(state, owner, EighteenThirtyTwoStockRules)
    const projected = copyStockState(state)
    applyProtection(projected, sale, playerId, state.priceProtection?.stacks ?? [])
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

function sellerFinished(state: HydratedEighteenThirtyTwoState, sellerPlayerId: string): boolean {
    return state.machineState === 'StockRound'
        ? state.turnManager.currentTurn()?.playerId !== sellerPlayerId
        : !state.trainFunding
}

const StartFields = Type.Object({
    type: Type.Literal('StartPriceProtection'),
    metadata: Type.Optional(
        Type.Object({ protectable: Type.Boolean() }, { additionalProperties: false })
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

/** Once the seller finishes, sets play aside for the presidents' decisions, if any may protect. */
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
        const protectable = !!protectionDecision(state)
        if (protectable)
            record.resume = {
                machineState: state.machineState,
                activePlayerIds: [...state.activePlayerIds]
            }
        else delete state.priceProtection
        this.metadata = { protectable }
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
                    restoredMarketSpaceId: Type.String(),
                    exemptOwnershipLimit: Type.Boolean()
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
 * the price returns to where it stood (§5.9, §5.9.3). They keep any holding above 60% until they
 * next sell shares of the company (§5.9.8).
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
        const payment = applyProtection(state, sale, this.playerId, record.stacks)
        const owner = { kind: 'player' as const, playerId: this.playerId }
        refreshOwnershipExcess(state, this.companyId, owner)
        const exemptOwnershipLimit = state.ownershipLimitExemptions.some(
            (exemption) =>
                exemption.companyId === this.companyId && sameOwner(exemption.owner, owner)
        )
        decided(state, this.companyId)
        record.protectorIds.push(this.playerId)
        this.metadata = {
            sellerPlayerId: record.sellerPlayerId,
            shares: sale.shares,
            payment,
            restoredMarketSpaceId: sale.fromMarketSpaceId,
            exemptOwnershipLimit
        }
    }
}

export const DeclineProtection = Type.Object(
    { ...DecisionFields, type: Type.Literal('DeclineProtection') },
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

export class HydratedDeclineProtection
    extends HydratableAction<typeof DeclineProtection>
    implements DeclineProtection
{
    declare type: 'DeclineProtection'
    declare playerId: string
    declare companyId: string
    constructor(data: DeclineProtection) {
        super(data instanceof HydratedDeclineProtection ? data.dehydrate() : data, DeclineValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return isCurrentDecision(state, this)
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'Only the deciding president may decline this sale')
        decided(state, this.companyId)
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
        const { machineState, activePlayerIds } = record.resume
        const lastProtector = record.protectorIds.at(-1)
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
            state.activePlayerIds = activePlayerIds
            // A restored price restores the company's place in the operating order (§4.1.3).
            if (record.protectorIds.length)
                reorderPendingOperatingCompanies(
                    state,
                    EighteenThirtyTwoOperatingRules.companyOrder(state)
                )
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
