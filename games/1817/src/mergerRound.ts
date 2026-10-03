import type {
    HydratedEighteenSeventeenState,
    EighteenSeventeenStateHandler,
    EighteenSeventeenState
} from './state.js'
import {
    dropCompany,
    activeMergerRound,
    mergerRoundOf,
    setMergerRound,
    type Conversion,
    type MergerRound
} from './state.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext
} from '@tabletop/common'
import {
    AssetTransfer,
    CashPayment,
    SharePurchaseDetails,
    StationTransfer,
    StockMarketMove,
    addCompanyStations,
    applyShareTransfer,
    canTakeLoan,
    companyMarketSpace,
    evaluateShareTransfer,
    isTakeLoan,
    nextOperatingCompany,
    settleCashPayments,
    turnOrderFrom,
    type OperatingState,
    type SharePurchaseResult,
    ShareSaleDetails,
    applyShareSale,
    evaluateShareDisposal,
    sharesOwned
} from '@tabletop/18xx'
import { liquidate } from './liquidation.js'
import { EighteenSeventeenLoanRules } from './loanRules.js'
import {
    canConvert,
    closingZones,
    convertCompany,
    mergeCompanies,
    mergeReason,
    mergeTargetIds,
    mergerRoundCompanyIds,
    presidentOf,
    sizeAfterConversion,
    stationPurchase,
    stationsForConversion,
    stationsOverLimit,
    trainsOverLimit,
    treasuryShareIds,
    trimStations
} from './mergerRules.js'
import { EighteenSeventeenStockRules, marketSale } from './stockRules.js'
import { SystemActionFirstHandler } from './systemActionFirstHandler.js'

type State = HydratedGameState & EighteenSeventeenState
type Context = MachineContext<HydratedEighteenSeventeenState>

function requireRound(state: EighteenSeventeenState): MergerRound {
    const round = activeMergerRound(state)
    assertExists(round, 'A merger round is in progress')
    return round
}

function requireConversion(state: EighteenSeventeenState): Conversion {
    const conversion = requireRound(state).conversion
    assertExists(conversion, 'A company has converted or merged')
    return conversion
}

function decidingCompanyId(state: EighteenSeventeenState): string | undefined {
    return requireRound(state).companyIds[0]
}

export function mergerRoundCompanyId(state: EighteenSeventeenState): string | undefined {
    const round = activeMergerRound(state)
    return round?.conversion?.companyId ?? round?.companyIds[0]
}

function convertingCompanyFor(state: EighteenSeventeenState, playerId: string): string | undefined {
    const companyId = requireRound(state).conversion?.companyId
    return companyId && presidentOf(state, companyId) === playerId ? companyId : undefined
}

export function stateAfterConversion(state: EighteenSeventeenState): string {
    const conversion = requireRound(state).conversion
    if (!conversion) return 'MergerRound'
    if (stationsOverLimit(state, conversion.companyId)) return 'ReducingStations'
    if (trainsOverLimit(state, conversion.companyId)) return 'DiscardingMergedTrains'
    if (conversion.traderIds.length) return 'TradingConvertedShares'
    return 'BorrowingAfterConversion'
}

function beginConversion(
    state: EighteenSeventeenState,
    conversion: Omit<Conversion, 'traderIds'>
): void {
    const round = requireRound(state)
    dropCompany(round, conversion.companyId)
    round.convertedIds.push(conversion.companyId)
    round.conversion = {
        ...conversion,
        traderIds: turnOrderFrom(
            state.turnManager.turnOrder,
            presidentOf(state, conversion.companyId)
        )
    }
}

export function mergerRoundDue(
    state: OperatingState & Pick<EighteenSeventeenState, 'mergerRound' | 'acquisitionRound'>
): boolean {
    const set = state.operatingSet
    const latest = mergerRoundOf(state)
    return (
        !!set &&
        !set.completed &&
        set.privateIncomePaid &&
        !nextOperatingCompany(state) &&
        set.exportedRound === set.roundNumber &&
        !(latest?.set === set.number && latest.round === set.roundNumber)
    )
}

const StartFields = Type.Object({
    type: Type.Literal('StartMergerRound'),
    metadata: Type.Optional(
        Type.Object({ companyIds: Type.Array(Type.String()) }, { additionalProperties: false })
    )
})
export const StartMergerRound: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof StartFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartFields.properties },
    { additionalProperties: false }
)
export type StartMergerRound = Type.Static<typeof StartMergerRound>
const StartValidator = Compile(StartMergerRound)
export function isStartMergerRound(action: GameAction): action is StartMergerRound {
    return (
        action instanceof HydratedStartMergerRound ||
        (action.type === 'StartMergerRound' && StartValidator.Check(action))
    )
}
export class HydratedStartMergerRound
    extends HydratableAction<typeof StartMergerRound>
    implements StartMergerRound
{
    declare type: 'StartMergerRound'
    declare metadata?: StartMergerRound['metadata']
    constructor(data: StartMergerRound) {
        super(data instanceof HydratedStartMergerRound ? data.dehydrate() : data, StartValidator)
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.System && mergerRoundDue(state),
            'A merger round follows each operating round'
        )
        const set = state.operatingSet
        assertExists(set, 'A merger round follows an operating round')
        const companyIds = mergerRoundCompanyIds(state)
        setMergerRound(state, {
            set: set.number,
            round: set.roundNumber,
            companyIds,
            closingZones: closingZones(state),
            convertedIds: [],
            completed: false
        })
        state.activePlayerIds = []
        this.metadata = { companyIds }
    }
}

const EndFields = Type.Object({ type: Type.Literal('EndMergerRound') })
export const EndMergerRound: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof EndFields.properties
> = Type.Object(
    { ...GameAction.properties, ...EndFields.properties },
    { additionalProperties: false }
)
export type EndMergerRound = Type.Static<typeof EndMergerRound>
const EndValidator = Compile(EndMergerRound)
export function isEndMergerRound(action: GameAction): action is EndMergerRound {
    return (
        action instanceof HydratedEndMergerRound ||
        (action.type === 'EndMergerRound' && EndValidator.Check(action))
    )
}
export class HydratedEndMergerRound
    extends HydratableAction<typeof EndMergerRound>
    implements EndMergerRound
{
    declare type: 'EndMergerRound'
    constructor(data: EndMergerRound) {
        super(data instanceof HydratedEndMergerRound ? data.dehydrate() : data, EndValidator)
    }
    apply(state: State): void {
        const round = requireRound(state)
        assert(
            this.source === ActionSource.System && !round.companyIds.length && !round.conversion,
            'The merger round ends once its companies are done'
        )
        round.completed = true
        state.activePlayerIds = []
    }
}

/** Opens the merger round once an operating round's companies and exports are done. */
export function startsMergerRounds(
    handler: EighteenSeventeenStateHandler
): EighteenSeventeenStateHandler {
    return new SystemActionFirstHandler(
        handler,
        StartMergerRound,
        (state) => (mergerRoundDue(state) ? {} : undefined),
        'MergerRound'
    )
}

const CompanyFields = { ...PlayerAction.properties, companyId: Type.String() }

export const ConvertCompany = Type.Object(
    {
        ...CompanyFields,
        type: Type.Literal('ConvertCompany'),
        metadata: Type.Optional(
            Type.Object(
                {
                    shareIds: Type.Array(Type.String()),
                    shareCount: Type.Integer(),
                    stationsOwed: Type.Integer({ minimum: 0 })
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type ConvertCompany = Type.Static<typeof ConvertCompany>
const ConvertValidator = Compile(ConvertCompany)
export function isConvertCompany(action: GameAction): action is ConvertCompany {
    return (
        action instanceof HydratedConvertCompany ||
        (action.type === 'ConvertCompany' && ConvertValidator.Check(action))
    )
}

function decidesFor(state: EighteenSeventeenState, playerId: string, companyId: string): boolean {
    return (
        decidingCompanyId(state) === companyId &&
        !requireRound(state).conversion &&
        presidentOf(state, companyId) === playerId
    )
}

export class HydratedConvertCompany
    extends HydratableAction<typeof ConvertCompany>
    implements ConvertCompany
{
    declare type: 'ConvertCompany'
    declare playerId: string
    declare companyId: string
    declare metadata?: ConvertCompany['metadata']
    constructor(data: ConvertCompany) {
        super(data instanceof HydratedConvertCompany ? data.dehydrate() : data, ConvertValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return decidesFor(state, this.playerId, this.companyId) && canConvert(state, this.companyId)
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            'Only the deciding company’s president may convert it'
        )
        const shareCount = sizeAfterConversion(state, this.companyId)
        const shareIds = convertCompany(state, this.companyId)
        const stationsOwed = stationsForConversion(state, this.companyId)
        beginConversion(state, {
            companyId: this.companyId,
            price: companyMarketSpace(state.stockMarket, this.companyId).price,
            stationsOwed
        })
        this.metadata = { shareIds, shareCount, stationsOwed }
    }
}

export const MergeCompanies = Type.Object(
    {
        ...CompanyFields,
        type: Type.Literal('MergeCompanies'),
        targetId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                {
                    price: Type.Integer({ minimum: 1 }),
                    assets: AssetTransfer,
                    stations: StationTransfer,
                    payments: Type.Array(CashPayment)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type MergeCompanies = Type.Static<typeof MergeCompanies>
const MergeValidator = Compile(MergeCompanies)
export function isMergeCompanies(action: GameAction): action is MergeCompanies {
    return (
        action instanceof HydratedMergeCompanies ||
        (action.type === 'MergeCompanies' && MergeValidator.Check(action))
    )
}
export class HydratedMergeCompanies
    extends HydratableAction<typeof MergeCompanies>
    implements MergeCompanies
{
    declare type: 'MergeCompanies'
    declare playerId: string
    declare companyId: string
    declare targetId: string
    declare metadata?: MergeCompanies['metadata']
    constructor(data: MergeCompanies) {
        super(data instanceof HydratedMergeCompanies ? data.dehydrate() : data, MergeValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            decidesFor(state, this.playerId, this.companyId) &&
            !mergeReason(state, this.companyId, this.targetId, requireRound(state).convertedIds)
        )
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            'Only the deciding company’s president may merge it'
        )
        const record = mergeCompanies(state, this.companyId, this.targetId)
        const round = requireRound(state)
        dropCompany(round, this.targetId)
        trimStations(state, this.companyId)
        beginConversion(state, {
            companyId: this.companyId,
            merged: true,
            price: record.price,
            stationsOwed: 0
        })
        this.metadata = record
    }
}

export const PassMerger = Type.Object(
    { ...CompanyFields, type: Type.Literal('PassMerger') },
    { additionalProperties: false }
)
export type PassMerger = Type.Static<typeof PassMerger>
const PassMergerValidator = Compile(PassMerger)
export function isPassMerger(action: GameAction): action is PassMerger {
    return (
        action instanceof HydratedPassMerger ||
        (action.type === 'PassMerger' && PassMergerValidator.Check(action))
    )
}

function mergerOptions(state: EighteenSeventeenState, companyId: string): string[] {
    return [
        ...(canConvert(state, companyId) ? ['ConvertCompany'] : []),
        ...(mergeTargetIds(state, companyId, requireRound(state).convertedIds).length
            ? ['MergeCompanies']
            : [])
    ]
}

export class HydratedPassMerger extends HydratableAction<typeof PassMerger> implements PassMerger {
    declare type: 'PassMerger'
    declare playerId: string
    declare companyId: string
    constructor(data: PassMerger) {
        super(data instanceof HydratedPassMerger ? data.dehydrate() : data, PassMergerValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            decidesFor(state, this.playerId, this.companyId) &&
            (this.source === ActionSource.User || !mergerOptions(state, this.companyId).length)
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'Only the deciding company’s president may pass')
        const round = requireRound(state)
        dropCompany(round, this.companyId)
    }
}

/** Each company in turn converts, merges or passes, until the round's companies are done. */
export class MergerRoundHandler implements EighteenSeventeenStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        const state = context.gameState
        if (isEndMergerRound(action))
            return (
                action.source === ActionSource.System &&
                !decidingCompanyId(state) &&
                !requireRound(state).conversion
            )
        if (
            action instanceof HydratedConvertCompany ||
            action instanceof HydratedMergeCompanies ||
            action instanceof HydratedPassMerger
        )
            return action.isValidFor(state)
        return false
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const state = context.gameState
        const companyId = decidingCompanyId(state)
        return companyId && decidesFor(state, playerId, companyId)
            ? [...mergerOptions(state, companyId), 'PassMerger']
            : []
    }
    enter(context: Context): void {
        const state = context.gameState
        const companyId = decidingCompanyId(state)
        if (!companyId) {
            context.addSystemAction(EndMergerRound, {})
            return
        }
        const playerId = presidentOf(state, companyId)
        state.activePlayerIds = [playerId]
        if (!mergerOptions(state, companyId).length)
            context.addSystemAction(PassMerger, { playerId, companyId })
    }
    onAction(action: HydratedAction, context: Context): string {
        if (isEndMergerRound(action)) return 'OperatingSet'
        return stateAfterConversion(context.gameState)
    }
}

export const BuyConvertedShare = Type.Object(
    {
        ...CompanyFields,
        type: Type.Literal('BuyConvertedShare'),
        expectedPrice: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(SharePurchaseDetails)
    },
    { additionalProperties: false }
)
export type BuyConvertedShare = Type.Static<typeof BuyConvertedShare>
const BuyValidator = Compile(BuyConvertedShare)
export function isBuyConvertedShare(action: GameAction): action is BuyConvertedShare {
    return (
        action instanceof HydratedBuyConvertedShare ||
        (action.type === 'BuyConvertedShare' && BuyValidator.Check(action))
    )
}

function currentTrader(state: EighteenSeventeenState): string | undefined {
    return requireRound(state).conversion?.traderIds[0]
}

/** The converted company's next treasury share bought by the player whose turn it is. */
export function convertedSharePurchase(
    state: EighteenSeventeenState,
    playerId: string
): SharePurchaseResult {
    const conversion = requireRound(state).conversion
    if (!conversion || currentTrader(state) !== playerId)
        return { reason: 'It is not this player’s turn to buy.' }
    const certificateId = treasuryShareIds(state, conversion.companyId)[0]
    const certificate = state.certificates.find((certificate) => certificate.id === certificateId)
    if (!certificate || certificate.retired || certificate.kind !== 'share')
        return { reason: 'The company has no treasury shares left.' }
    const buyer = { kind: 'player' as const, playerId }
    return evaluateShareTransfer(
        state,
        { playerId, buyer, certificateId: certificate.id },
        EighteenSeventeenStockRules,
        EighteenSeventeenStockRules.purchaseTerms(state, certificate, buyer)
    )
}

export class HydratedBuyConvertedShare
    extends HydratableAction<typeof BuyConvertedShare>
    implements BuyConvertedShare
{
    declare type: 'BuyConvertedShare'
    declare playerId: string
    declare companyId: string
    declare expectedPrice: number
    declare metadata?: SharePurchaseDetails
    constructor(data: BuyConvertedShare) {
        super(data instanceof HydratedBuyConvertedShare ? data.dehydrate() : data, BuyValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            requireRound(state).conversion?.companyId === this.companyId &&
            convertedSharePurchase(state, this.playerId).details?.price === this.expectedPrice
        )
    }
    apply(state: State): void {
        const { details, reason } = convertedSharePurchase(state, this.playerId)
        assert(
            this.source === ActionSource.User && this.isValidFor(state) && details,
            reason ?? 'The share’s price has changed'
        )
        applyShareTransfer(state, details)
        if (presidentOf(state, this.companyId) !== this.playerId)
            requireConversion(state).traderIds.shift()
        this.metadata = details
    }
}

export function convertedShareSales(
    state: EighteenSeventeenState,
    playerId: string
): ShareSaleDetails[] {
    const conversion = requireRound(state).conversion
    if (
        !conversion ||
        currentTrader(state) !== playerId ||
        presidentOf(state, conversion.companyId) === playerId
    )
        return []
    const seller = { kind: 'player' as const, playerId }
    const choices: ShareSaleDetails[] = []
    for (let shares = 1; shares <= sharesOwned(state, conversion.companyId, seller); shares++) {
        const result = evaluateShareDisposal(
            state,
            seller,
            [{ companyId: conversion.companyId, shares }],
            {
                saleTerms: marketSale,
                presidencyCandidates: EighteenSeventeenStockRules.presidencyCandidates
            }
        )
        if (result.details) choices.push(result.details)
    }
    return choices
}

export const SellConvertedShares = Type.Object(
    {
        ...CompanyFields,
        type: Type.Literal('SellConvertedShares'),
        shares: Type.Integer({ minimum: 1 }),
        expectedProceeds: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(ShareSaleDetails)
    },
    { additionalProperties: false }
)
export type SellConvertedShares = Type.Static<typeof SellConvertedShares>
const SellValidator = Compile(SellConvertedShares)
export function isSellConvertedShares(action: GameAction): action is SellConvertedShares {
    return (
        action instanceof HydratedSellConvertedShares ||
        (action.type === 'SellConvertedShares' && SellValidator.Check(action))
    )
}
export class HydratedSellConvertedShares
    extends HydratableAction<typeof SellConvertedShares>
    implements SellConvertedShares
{
    declare type: 'SellConvertedShares'
    declare playerId: string
    declare companyId: string
    declare shares: number
    declare expectedProceeds: number
    declare metadata?: ShareSaleDetails
    constructor(data: SellConvertedShares) {
        super(data instanceof HydratedSellConvertedShares ? data.dehydrate() : data, SellValidator)
    }
    private sale(state: EighteenSeventeenState): ShareSaleDetails | undefined {
        return convertedShareSales(state, this.playerId).find(
            (details) =>
                details.sales[0].companyId === this.companyId &&
                details.sales[0].shares === this.shares &&
                details.proceeds === this.expectedProceeds
        )
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return this.source === ActionSource.User && !!this.sale(state)
    }
    apply(state: State): void {
        const details = this.sale(state)
        assert(this.source === ActionSource.User && details, 'Choose a legal post-conversion sale')
        applyShareSale(state, details)
        EighteenSeventeenStockRules.afterSale?.(state)
        requireConversion(state).traderIds.shift()
        this.metadata = details
    }
}

function canTradeConvertedShares(state: EighteenSeventeenState, playerId: string): boolean {
    return (
        !!convertedSharePurchase(state, playerId).details ||
        convertedShareSales(state, playerId).length > 0
    )
}

export const PassConvertedShares = Type.Object(
    { ...CompanyFields, type: Type.Literal('PassConvertedShares') },
    { additionalProperties: false }
)
export type PassConvertedShares = Type.Static<typeof PassConvertedShares>
const PassSharesValidator = Compile(PassConvertedShares)
export function isPassConvertedShares(action: GameAction): action is PassConvertedShares {
    return (
        action instanceof HydratedPassConvertedShares ||
        (action.type === 'PassConvertedShares' && PassSharesValidator.Check(action))
    )
}
export class HydratedPassConvertedShares
    extends HydratableAction<typeof PassConvertedShares>
    implements PassConvertedShares
{
    declare type: 'PassConvertedShares'
    declare playerId: string
    declare companyId: string
    constructor(data: PassConvertedShares) {
        super(
            data instanceof HydratedPassConvertedShares ? data.dehydrate() : data,
            PassSharesValidator
        )
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            requireRound(state).conversion?.companyId === this.companyId &&
            currentTrader(state) === this.playerId &&
            (this.source === ActionSource.User || !canTradeConvertedShares(state, this.playerId))
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'Only the player whose turn it is may pass')
        requireConversion(state).traderIds.shift()
    }
}

/** The president buys; other shareholders may buy once, sell a block, or pass. */
export class TradingConvertedSharesHandler implements EighteenSeventeenStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        return action instanceof HydratedBuyConvertedShare ||
            action instanceof HydratedSellConvertedShares ||
            action instanceof HydratedPassConvertedShares
            ? action.isValidFor(context.gameState)
            : false
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const state = context.gameState
        if (currentTrader(state) !== playerId) return []
        return [
            ...(convertedSharePurchase(state, playerId).details ? ['BuyConvertedShare'] : []),
            ...(convertedShareSales(state, playerId).length ? ['SellConvertedShares'] : []),
            'PassConvertedShares'
        ]
    }
    enter(context: Context): void {
        const state = context.gameState
        const conversion = requireConversion(state)
        const playerId = currentTrader(state)
        assertExists(playerId, 'A player is trading')
        state.activePlayerIds = [playerId]
        if (!canTradeConvertedShares(state, playerId))
            context.addSystemAction(PassConvertedShares, {
                playerId,
                companyId: conversion.companyId
            })
    }
    onAction(_action: HydratedAction, context: Context): string {
        return stateAfterConversion(context.gameState)
    }
}

export const FinishConversionLoans = Type.Object(
    {
        ...CompanyFields,
        type: Type.Literal('FinishConversionLoans'),
        metadata: Type.Optional(
            Type.Object(
                {
                    stations: Type.Integer({ minimum: 0 }),
                    payment: Type.Optional(CashPayment),
                    liquidation: Type.Optional(StockMarketMove)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type FinishConversionLoans = Type.Static<typeof FinishConversionLoans>
const FinishValidator = Compile(FinishConversionLoans)
export function isFinishConversionLoans(action: GameAction): action is FinishConversionLoans {
    return (
        action instanceof HydratedFinishConversionLoans ||
        (action.type === 'FinishConversionLoans' && FinishValidator.Check(action))
    )
}

function canBorrow(state: EighteenSeventeenState, playerId: string): boolean {
    const conversion = requireRound(state).conversion
    return (
        !!conversion &&
        canTakeLoan(state, EighteenSeventeenLoanRules, playerId, conversion.companyId)
    )
}

export class HydratedFinishConversionLoans
    extends HydratableAction<typeof FinishConversionLoans>
    implements FinishConversionLoans
{
    declare type: 'FinishConversionLoans'
    declare playerId: string
    declare companyId: string
    declare metadata?: FinishConversionLoans['metadata']
    constructor(data: FinishConversionLoans) {
        super(
            data instanceof HydratedFinishConversionLoans ? data.dehydrate() : data,
            FinishValidator
        )
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            convertingCompanyFor(state, this.playerId) === this.companyId &&
            (this.source === ActionSource.User || !canBorrow(state, this.playerId))
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'Only the converted company’s president may finish')
        const purchase = stationPurchase(
            state,
            this.companyId,
            requireConversion(state).stationsOwed
        )
        delete requireRound(state).conversion
        if (!purchase.stations) {
            this.metadata = { stations: 0 }
            return
        }
        if (!purchase.affordable) {
            this.metadata = { stations: 0, liquidation: liquidate(state, this.companyId) }
            return
        }
        const payment = {
            from: { kind: 'company' as const, companyId: this.companyId },
            to: { kind: 'bank' as const },
            amount: purchase.cost
        }
        if (payment.amount) settleCashPayments(state, [payment])
        addCompanyStations(state, this.companyId, purchase.stations)
        this.metadata = { stations: purchase.stations, ...(payment.amount ? { payment } : {}) }
    }
}

/** The converted company may borrow, then buys the stations its size needs. */
export class BorrowingAfterConversionHandler implements EighteenSeventeenStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        const state = context.gameState
        if (isTakeLoan(action))
            return (
                action.source === ActionSource.User &&
                requireRound(state).conversion?.companyId === action.companyId &&
                canBorrow(state, action.playerId)
            )
        return action instanceof HydratedFinishConversionLoans ? action.isValidFor(state) : false
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const state = context.gameState
        if (!convertingCompanyFor(state, playerId)) return []
        return [...(canBorrow(state, playerId) ? ['TakeLoan'] : []), 'FinishConversionLoans']
    }
    enter(context: Context): void {
        const state = context.gameState
        const conversion = requireConversion(state)
        const playerId = presidentOf(state, conversion.companyId)
        state.activePlayerIds = [playerId]
        if (!canBorrow(state, playerId))
            context.addSystemAction(FinishConversionLoans, {
                playerId,
                companyId: conversion.companyId
            })
    }
    onAction(action: HydratedAction, _context: Context): string {
        return isTakeLoan(action) ? 'BorrowingAfterConversion' : 'MergerRound'
    }
}
