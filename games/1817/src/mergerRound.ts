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
    controllingOwner,
    evaluateShareTransfer,
    finiteCashOwnedBy,
    getCompany,
    isTakeLoan,
    nextOperatingCompany,
    settleCashPayments,
    trainsOwnedBy,
    unownedTrain,
    type EighteenXXState,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState,
    type SharePurchaseResult
} from '@tabletop/18xx'
import { liquidate } from './liquidation.js'
import { EighteenSeventeenLoanRules } from './loanRules.js'
import {
    canConvert,
    convertCompany,
    mergeCompanies,
    mergeReason,
    mergeTargetIds,
    mergerRoundCompanyIds,
    stationsForConversion,
    stationsOverLimit,
    trainsOverLimit,
    treasuryShareIds,
    trimStations
} from './mergerRules.js'
import { activeMergerRound, mergerRoundOf, setMergerRound, type MergerRound } from './state.js'
import { EighteenSeventeenStockRules, StationPrice } from './stockRules.js'

type State = HydratedGameState & EighteenXXState
type Context = MachineContext<HydratedEighteenXXState>

function requireRound(state: object): MergerRound {
    const round = activeMergerRound(state)
    assertExists(round, 'A merger round is in progress')
    return round
}

function presidentOf(state: EighteenXXState, companyId: string): string {
    const president = controllingOwner(state, companyId)
    assertExists(president, 'A company in the merger round has a president')
    return president.playerId
}

/** The company whose president decides now, until the round's companies are done. */
export function mergerRoundCompanyId(state: object): string | undefined {
    return requireRound(state).companyIds[0]
}

/** The company the merger round is dealing with, while one is in progress. */
export function mergerRoundSubject(state: object): string | undefined {
    const round = activeMergerRound(state)
    return round?.conversion?.companyId ?? round?.companyIds[0]
}

function seatOrderFrom(state: EighteenXXState, playerId: string): string[] {
    const order = state.turnManager.turnOrder
    const start = order.indexOf(playerId)
    return [...order.slice(start), ...order.slice(0, start)]
}

/** The round's next state while a conversion is underway, or the round itself once done. */
function stateAfterConversion(state: EighteenXXState): string {
    const conversion = requireRound(state).conversion
    if (!conversion) return 'MergerRound'
    if (stationsOverLimit(state, conversion.companyId)) return 'ReducingStations'
    if (trainsOverLimit(state, conversion.companyId)) return 'DiscardingMergedTrains'
    if (conversion.traderIds.length && treasuryShareIds(state, conversion.companyId).length)
        return 'TradingConvertedShares'
    return 'BorrowingAfterConversion'
}

function startsConversion(
    state: EighteenXXState,
    companyId: string,
    price: number,
    stationsOwed: number,
    merged: boolean
): void {
    const round = requireRound(state)
    round.companyIds = round.companyIds.filter((id) => id !== companyId)
    round.convertedIds.push(companyId)
    round.conversion = {
        companyId,
        ...(merged ? { merged: true } : {}),
        price,
        traderIds: seatOrderFrom(state, presidentOf(state, companyId)),
        stationsOwed
    }
}

// ---- Round start and end ----

export function mergerRoundDue(state: EighteenXXState): boolean {
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
export class MergerRoundStartHandler implements EighteenXXStateHandler {
    constructor(private readonly handler: EighteenXXStateHandler) {}
    isValidAction(action: HydratedAction, context: Context): boolean {
        return isStartMergerRound(action)
            ? action.source === ActionSource.System && mergerRoundDue(context.gameState)
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: Context): void {
        if (mergerRoundDue(context.gameState)) context.addSystemAction(StartMergerRound, {})
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: Context): string {
        return isStartMergerRound(action) ? 'MergerRound' : this.handler.onAction(action, context)
    }
}

// ---- The company's decision ----

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

function decidesFor(state: EighteenXXState, playerId: string, companyId: string): boolean {
    return (
        mergerRoundCompanyId(state) === companyId &&
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
    isValidFor(state: EighteenXXState): boolean {
        return decidesFor(state, this.playerId, this.companyId) && canConvert(state, this.companyId)
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            'Only the deciding company’s president may convert it'
        )
        const shareIds = convertCompany(state, this.companyId)
        const stationsOwed = stationsForConversion(state, this.companyId)
        startsConversion(
            state,
            this.companyId,
            companyMarketSpace(state.stockMarket, this.companyId).price,
            stationsOwed,
            false
        )
        this.metadata = {
            shareIds,
            shareCount: getCompany(state, this.companyId).shareCount ?? 0,
            stationsOwed
        }
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
    isValidFor(state: EighteenXXState): boolean {
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
        round.companyIds = round.companyIds.filter((id) => id !== this.targetId)
        trimStations(state, this.companyId)
        startsConversion(state, this.companyId, record.price, 0, true)
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

function mergerOptions(state: EighteenXXState, companyId: string): string[] {
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
    isValidFor(state: EighteenXXState): boolean {
        return (
            decidesFor(state, this.playerId, this.companyId) &&
            (this.source === ActionSource.User || !mergerOptions(state, this.companyId).length)
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'Only the deciding company’s president may pass')
        const round = requireRound(state)
        round.companyIds = round.companyIds.filter((id) => id !== this.companyId)
    }
}

/** Each company in turn converts, merges or passes, until the round's companies are done. */
export class MergerRoundHandler implements EighteenXXStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        const state = context.gameState
        if (isEndMergerRound(action))
            return (
                action.source === ActionSource.System &&
                !mergerRoundCompanyId(state) &&
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
        const companyId = mergerRoundCompanyId(state)
        return companyId && decidesFor(state, playerId, companyId)
            ? [...mergerOptions(state, companyId), 'PassMerger']
            : []
    }
    enter(context: Context): void {
        const state = context.gameState
        const companyId = mergerRoundCompanyId(state)
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

// ---- Trading the new shares ----

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

function trader(state: EighteenXXState): string | undefined {
    return requireRound(state).conversion?.traderIds[0]
}

/** The converted company's next treasury share bought by the player whose turn it is. */
export function convertedSharePurchase(
    state: EighteenXXState,
    playerId: string
): SharePurchaseResult {
    const conversion = requireRound(state).conversion
    if (!conversion || trader(state) !== playerId)
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
    isValidFor(state: EighteenXXState): boolean {
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
        const conversion = requireRound(state).conversion
        assertExists(conversion, 'Shares are bought after a conversion')
        if (presidentOf(state, this.companyId) !== this.playerId) conversion.traderIds.shift()
        this.metadata = details
    }
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
    isValidFor(state: EighteenXXState): boolean {
        return (
            requireRound(state).conversion?.companyId === this.companyId &&
            trader(state) === this.playerId &&
            (this.source === ActionSource.User ||
                !convertedSharePurchase(state, this.playerId).details)
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'Only the player whose turn it is may pass')
        requireRound(state).conversion?.traderIds.shift()
    }
}

/** From the president, players in turn buy the converted company's treasury shares or pass. */
export class TradingConvertedSharesHandler implements EighteenXXStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        return action instanceof HydratedBuyConvertedShare ||
            action instanceof HydratedPassConvertedShares
            ? action.isValidFor(context.gameState)
            : false
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const state = context.gameState
        if (trader(state) !== playerId) return []
        return [
            ...(convertedSharePurchase(state, playerId).details ? ['BuyConvertedShare'] : []),
            'PassConvertedShares'
        ]
    }
    enter(context: Context): void {
        const state = context.gameState
        const conversion = requireRound(state).conversion
        const playerId = trader(state)
        assertExists(conversion, 'Shares are traded after a conversion')
        assertExists(playerId, 'A player is trading')
        state.activePlayerIds = [playerId]
        if (!convertedSharePurchase(state, playerId).details)
            context.addSystemAction(PassConvertedShares, {
                playerId,
                companyId: conversion.companyId
            })
    }
    onAction(_action: HydratedAction, context: Context): string {
        return stateAfterConversion(context.gameState)
    }
}

// ---- Loans and stations ----

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

function canBorrow(state: EighteenXXState, playerId: string): boolean {
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
    isValidFor(state: EighteenXXState): boolean {
        return (
            requireRound(state).conversion?.companyId === this.companyId &&
            presidentOf(state, this.companyId) === this.playerId &&
            (this.source === ActionSource.User || !canBorrow(state, this.playerId))
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'Only the converted company’s president may finish')
        const round = requireRound(state)
        const conversion = round.conversion
        assertExists(conversion, 'Loans follow a conversion')
        const company = { kind: 'company' as const, companyId: this.companyId }
        const cost = conversion.stationsOwed * StationPrice
        delete round.conversion
        if (!cost) {
            this.metadata = { stations: 0 }
            return
        }
        if (finiteCashOwnedBy(state, company) < cost) {
            this.metadata = { stations: 0, liquidation: liquidate(state, this.companyId) }
            return
        }
        const payment = { from: company, to: { kind: 'bank' as const }, amount: cost }
        settleCashPayments(state, [payment])
        addCompanyStations(state, this.companyId, conversion.stationsOwed)
        this.metadata = { stations: conversion.stationsOwed, payment }
    }
}

/** The converted company may borrow, then buys the stations its size needs. */
export class BorrowingAfterConversionHandler implements EighteenXXStateHandler {
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
        const conversion = requireRound(state).conversion
        if (!conversion || presidentOf(state, conversion.companyId) !== playerId) return []
        return [...(canBorrow(state, playerId) ? ['TakeLoan'] : []), 'FinishConversionLoans']
    }
    enter(context: Context): void {
        const state = context.gameState
        const conversion = requireRound(state).conversion
        assertExists(conversion, 'Loans follow a conversion')
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

// ---- A merger's stations and trains ----

export const RemoveStation = Type.Object(
    { ...CompanyFields, type: Type.Literal('RemoveStation'), stationId: Type.String() },
    { additionalProperties: false }
)
export type RemoveStation = Type.Static<typeof RemoveStation>
const RemoveValidator = Compile(RemoveStation)
export function isRemoveStation(action: GameAction): action is RemoveStation {
    return (
        action instanceof HydratedRemoveStation ||
        (action.type === 'RemoveStation' && RemoveValidator.Check(action))
    )
}
export class HydratedRemoveStation
    extends HydratableAction<typeof RemoveStation>
    implements RemoveStation
{
    declare type: 'RemoveStation'
    declare playerId: string
    declare companyId: string
    declare stationId: string
    constructor(data: RemoveStation) {
        super(data instanceof HydratedRemoveStation ? data.dehydrate() : data, RemoveValidator)
    }
    isValidFor(state: EighteenXXState): boolean {
        return (
            requireRound(state).conversion?.companyId === this.companyId &&
            presidentOf(state, this.companyId) === this.playerId &&
            stationsOverLimit(state, this.companyId) > 0 &&
            state.stations.some(
                (station) =>
                    station.id === this.stationId &&
                    station.companyId === this.companyId &&
                    station.status === 'placed'
            )
        )
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            'Only the merged company’s president removes its excess stations'
        )
        state.stations = state.stations.map((station) =>
            station.id === this.stationId
                ? { id: station.id, companyId: station.companyId, status: 'removed' as const }
                : station
        )
    }
}

export const DiscardMergedTrain = Type.Object(
    { ...CompanyFields, type: Type.Literal('DiscardMergedTrain'), trainId: Type.String() },
    { additionalProperties: false }
)
export type DiscardMergedTrain = Type.Static<typeof DiscardMergedTrain>
const DiscardValidator = Compile(DiscardMergedTrain)
export function isDiscardMergedTrain(action: GameAction): action is DiscardMergedTrain {
    return (
        action instanceof HydratedDiscardMergedTrain ||
        (action.type === 'DiscardMergedTrain' && DiscardValidator.Check(action))
    )
}
export class HydratedDiscardMergedTrain
    extends HydratableAction<typeof DiscardMergedTrain>
    implements DiscardMergedTrain
{
    declare type: 'DiscardMergedTrain'
    declare playerId: string
    declare companyId: string
    declare trainId: string
    constructor(data: DiscardMergedTrain) {
        super(
            data instanceof HydratedDiscardMergedTrain ? data.dehydrate() : data,
            DiscardValidator
        )
    }
    isValidFor(state: EighteenXXState): boolean {
        return (
            requireRound(state).conversion?.companyId === this.companyId &&
            presidentOf(state, this.companyId) === this.playerId &&
            trainsOverLimit(state, this.companyId) > 0 &&
            trainsOwnedBy(state, { kind: 'company', companyId: this.companyId }).some(
                (train) => train.id === this.trainId
            )
        )
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            'Only the merged company’s president discards its excess trains'
        )
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.id === this.trainId ? unownedTrain(train, 'market') : train
        )
    }
}

/** The merged company's president removes stations, or discards trains, over the limit. */
export class MergerExcessHandler implements EighteenXXStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        return action instanceof HydratedRemoveStation ||
            action instanceof HydratedDiscardMergedTrain
            ? action.isValidFor(context.gameState)
            : false
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const state = context.gameState
        const conversion = requireRound(state).conversion
        if (!conversion || presidentOf(state, conversion.companyId) !== playerId) return []
        return stationsOverLimit(state, conversion.companyId)
            ? ['RemoveStation']
            : trainsOverLimit(state, conversion.companyId)
              ? ['DiscardMergedTrain']
              : []
    }
    enter(context: Context): void {
        const conversion = requireRound(context.gameState).conversion
        assertExists(conversion, 'Excess follows a merger')
        context.gameState.activePlayerIds = [presidentOf(context.gameState, conversion.companyId)]
    }
    onAction(_action: HydratedAction, context: Context): string {
        return stateAfterConversion(context.gameState)
    }
}
