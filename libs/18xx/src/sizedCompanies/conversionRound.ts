import {
    ActionSource,
    assert,
    assertExists,
    turnOrderFrom,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { systemEvent, titleAction, type SystemEventSchema } from '../actions/titleAction.js'
import { AssetTransfer, StationTransfer } from '../company/companyMerger.js'
import { RoundEnd, roundEnd } from '../ending/roundEnd.js'
import type { ValuationRules } from '../ending/finalWealth.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { sharesOwned } from '../finance/finance.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import type { LoanRules } from '../loans/loans.js'
import { canTakeLoan, isTakeLoan } from '../loans/takeLoan.js'
import { addCompanyStations } from '../map/station.js'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import {
    SharePurchaseDetails,
    applyShareTransfer,
    evaluateShareTransfer,
    type SharePurchaseResult
} from '../stock/sharePurchase.js'
import { ShareSaleDetails, applyShareSale, evaluateShareDisposal } from '../stock/shareSale.js'
import { StockMarketMove } from '../stock/stockMarket.js'
import type { StockRules } from '../stock/stockRules.js'
import {
    actingCompanyAction,
    actingCompanyChoices,
    type ActingCompanyAction
} from './actingCompanyActions.js'
import type { CompanyConversions } from './companyConversions.js'
import type { SizedCompanyMarket } from './sizedCompanyMarket.js'
import {
    activeConversionRound,
    conversionRoundOf,
    dropCompany,
    type Conversion,
    type ConversionRound,
    type HydratedSizedCompanyState,
    type SizedCompanyRecords,
    type SizedCompanyState
} from './sizedCompanyState.js'

type State = SizedCompanyState

/** A title's merger and conversion round, which follows each of its operating rounds. */
export interface ConversionRoundRules<S extends HydratedSizedCompanyState> {
    market: SizedCompanyMarket
    conversions: CompanyConversions
    stockRules: StockRules
    loanRules: LoanRules
    valuationRules: ValuationRules
    /** The title's own actions a company may take while it decides or borrows in the round. */
    companyActions?: readonly ActingCompanyAction<S>[]
}

const CompanyFields = { companyId: Type.String() }

const StartMergerRoundFields = {
    metadata: Type.Optional(
        Type.Object({ companyIds: Type.Array(Type.String()) }, { additionalProperties: false })
    )
}
const StartMergerRoundAction = systemEvent('StartMergerRound', StartMergerRoundFields)
export const StartConversionRound: SystemEventSchema<
    'StartMergerRound',
    typeof StartMergerRoundFields
> = StartMergerRoundAction.schema
export type StartConversionRound = Type.Static<typeof StartConversionRound>
export const isStartConversionRound = StartMergerRoundAction.is

const EndMergerRoundFields = {
    metadata: Type.Optional(Type.Object({ roundEnd: RoundEnd }, { additionalProperties: false }))
}
const EndMergerRoundAction = systemEvent('EndMergerRound', EndMergerRoundFields)
export const EndConversionRound: SystemEventSchema<'EndMergerRound', typeof EndMergerRoundFields> =
    EndMergerRoundAction.schema
export type EndConversionRound = Type.Static<typeof EndConversionRound>
export const isEndConversionRound = EndMergerRoundAction.is

const ConvertCompanyAction = titleAction('ConvertCompany', {
    ...CompanyFields,
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
})
export const ConvertCompany = ConvertCompanyAction.schema
export type ConvertCompany = Type.Static<typeof ConvertCompany>
export const isConvertCompany = ConvertCompanyAction.is

const MergeCompaniesAction = titleAction('MergeCompanies', {
    ...CompanyFields,
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
})
export const MergeCompanies = MergeCompaniesAction.schema
export type MergeCompanies = Type.Static<typeof MergeCompanies>
export const isMergeCompanies = MergeCompaniesAction.is

const PassMergerAction = titleAction('PassMerger', CompanyFields)
export const PassConversion = PassMergerAction.schema
export type PassConversion = Type.Static<typeof PassConversion>
export const isPassConversion = PassMergerAction.is

const BuyConvertedShareAction = titleAction('BuyConvertedShare', {
    ...CompanyFields,
    expectedPrice: Type.Integer({ minimum: 1 }),
    metadata: Type.Optional(SharePurchaseDetails)
})
export const BuyConvertedShare = BuyConvertedShareAction.schema
export type BuyConvertedShare = Type.Static<typeof BuyConvertedShare>
export const isBuyConvertedShare = BuyConvertedShareAction.is

const SellConvertedSharesAction = titleAction('SellConvertedShares', {
    ...CompanyFields,
    shares: Type.Integer({ minimum: 1 }),
    expectedProceeds: Type.Integer({ minimum: 1 }),
    metadata: Type.Optional(ShareSaleDetails)
})
export const SellConvertedShares = SellConvertedSharesAction.schema
export type SellConvertedShares = Type.Static<typeof SellConvertedShares>
export const isSellConvertedShares = SellConvertedSharesAction.is

const PassConvertedSharesAction = titleAction('PassConvertedShares', CompanyFields)
export const PassConvertedShares = PassConvertedSharesAction.schema
export type PassConvertedShares = Type.Static<typeof PassConvertedShares>
export const isPassConvertedShares = PassConvertedSharesAction.is

const FinishConversionLoansAction = titleAction('FinishConversionLoans', {
    ...CompanyFields,
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
})
export const FinishConversionLoans = FinishConversionLoansAction.schema
export type FinishConversionLoans = Type.Static<typeof FinishConversionLoans>
export const isFinishConversionLoans = FinishConversionLoansAction.is

type CompanyAction = { playerId: string; companyId: string }

/**
 * The merger and conversion round of the 1817 family: each company in operating order may
 * convert or merge with another of its size; its shareholders then trade its treasury shares,
 * and it may borrow before buying the stations its new size needs.
 */
export class ConversionRounds<S extends HydratedSizedCompanyState = HydratedSizedCompanyState> {
    constructor(readonly rules: ConversionRoundRules<S>) {}

    private get companyActions(): readonly ActingCompanyAction<S>[] {
        return this.rules.companyActions ?? []
    }

    private requireRound(state: State): ConversionRound {
        const round = activeConversionRound(state)
        assertExists(round, 'A merger round is in progress')
        return round
    }

    private requireConversion(state: State): Conversion {
        const conversion = this.requireRound(state).conversion
        assertExists(conversion, 'A company has converted or merged')
        return conversion
    }

    private decidingCompanyId(state: State): string | undefined {
        return this.requireRound(state).companyIds[0]
    }

    /** The company the round is busy with: the one converting, or the next to decide. */
    companyId(state: State): string | undefined {
        const round = activeConversionRound(state)
        return round?.conversion?.companyId ?? round?.companyIds[0]
    }

    private convertingCompanyFor(state: State, playerId: string): string | undefined {
        const companyId = this.requireRound(state).conversion?.companyId
        return companyId && this.rules.conversions.presidentId(state, companyId) === playerId
            ? companyId
            : undefined
    }

    /** The round's next state after a company's conversion moves on. */
    stateAfterConversion(state: State): string {
        const { conversions } = this.rules
        const conversion = this.requireRound(state).conversion
        if (!conversion) return 'MergerRound'
        if (conversions.rules.stations.removableStations(state, conversion.companyId).length)
            return 'ReducingStations'
        if (conversions.trainsOverLimit(state, conversion.companyId))
            return 'DiscardingMergedTrains'
        if (conversion.traderIds.length) return 'TradingConvertedShares'
        return 'BorrowingAfterConversion'
    }

    private beginConversion(state: State, conversion: Omit<Conversion, 'traderIds'>): void {
        const round = this.requireRound(state)
        dropCompany(round, conversion.companyId)
        round.convertedIds.push(conversion.companyId)
        round.conversion = {
            ...conversion,
            traderIds: turnOrderFrom(
                state.turnManager.turnOrder,
                this.rules.conversions.presidentId(state, conversion.companyId)
            )
        }
    }

    /** The companies that take part in a merger round, in operating order. */
    companyIds(state: State): string[] {
        const { market } = this.rules
        return market.chart.order(state.stockMarket).filter((companyId) => {
            const company = state.companies.find((company) => company.id === companyId)
            return !!company?.floated && !market.inClosingZone(state.stockMarket, companyId)
        })
    }

    /** A merger round follows each operating round once its companies and exports are done. */
    due(state: OperatingState & Pick<SizedCompanyRecords, 'mergerRound'>): boolean {
        const set = state.operatingSet
        const latest = conversionRoundOf(state)
        return (
            !!set &&
            !set.completed &&
            set.privateIncomePaid &&
            !nextOperatingCompany(state) &&
            set.exportedRound === set.roundNumber &&
            !(latest?.set === set.number && latest.round === set.roundNumber)
        )
    }

    private decidesFor(state: State, playerId: string, companyId: string): boolean {
        return (
            this.decidingCompanyId(state) === companyId &&
            !this.requireRound(state).conversion &&
            this.rules.conversions.presidentId(state, companyId) === playerId
        )
    }

    private mergerOptions(state: State, companyId: string): string[] {
        const { conversions } = this.rules
        return [
            ...(conversions.canConvert(state, companyId) ? ['ConvertCompany'] : []),
            ...(conversions.mergeTargetIds(state, companyId, this.requireRound(state).convertedIds)
                .length
                ? ['MergeCompanies']
                : [])
        ]
    }

    private titleChoices(state: S, playerId: string, companyId: string): string[] {
        return actingCompanyChoices(this.companyActions, state, playerId, companyId)
    }

    private convertValid(state: State, action: CompanyAction): boolean {
        return (
            this.decidesFor(state, action.playerId, action.companyId) &&
            this.rules.conversions.canConvert(state, action.companyId)
        )
    }

    private mergeValid(state: State, action: CompanyAction & { targetId: string }): boolean {
        return (
            this.decidesFor(state, action.playerId, action.companyId) &&
            !this.rules.conversions.mergeReason(
                state,
                action.companyId,
                action.targetId,
                this.requireRound(state).convertedIds
            )
        )
    }

    private passValid(state: S, action: CompanyAction & { source: ActionSource }): boolean {
        return (
            this.decidesFor(state, action.playerId, action.companyId) &&
            (action.source === ActionSource.User ||
                (!this.mergerOptions(state, action.companyId).length &&
                    !this.titleChoices(state, action.playerId, action.companyId).length))
        )
    }

    private currentTrader(state: State): string | undefined {
        return this.requireRound(state).conversion?.traderIds[0]
    }

    /** The converted company's next treasury share bought by the player whose turn it is. */
    convertedSharePurchase(state: State, playerId: string): SharePurchaseResult {
        const { stockRules, conversions } = this.rules
        const conversion = this.requireRound(state).conversion
        if (!conversion || this.currentTrader(state) !== playerId)
            return { reason: 'It is not this player’s turn to buy.' }
        const certificateId = conversions.treasuryShareIds(state, conversion.companyId)[0]
        const certificate = state.certificates.find(
            (certificate) => certificate.id === certificateId
        )
        if (!certificate || certificate.kind !== 'share')
            return { reason: 'The company has no treasury shares left.' }
        const buyer = { kind: 'player' as const, playerId }
        return evaluateShareTransfer(
            state,
            { playerId, buyer, certificateId: certificate.id },
            stockRules,
            stockRules.purchaseTerms(state, certificate, buyer)
        )
    }

    /** The blocks a shareholder other than the president may sell instead of buying. */
    convertedShareSales(state: State, playerId: string): ShareSaleDetails[] {
        const { market, stockRules, conversions } = this.rules
        const conversion = this.requireRound(state).conversion
        if (
            !conversion ||
            this.currentTrader(state) !== playerId ||
            conversions.presidentId(state, conversion.companyId) === playerId
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
                    market: market.chart,
                    charters: market.rules.charters,
                    saleTerms: (state, companyId, shares) =>
                        market.marketSale(state, companyId, shares),
                    presidencyCandidates: stockRules.presidencyCandidates
                }
            )
            if (result.details) choices.push(result.details)
        }
        return choices
    }

    private canTradeConvertedShares(state: State, playerId: string): boolean {
        return (
            !!this.convertedSharePurchase(state, playerId).details ||
            this.convertedShareSales(state, playerId).length > 0
        )
    }

    private buyValid(state: State, action: CompanyAction & { expectedPrice: number }): boolean {
        return (
            this.requireRound(state).conversion?.companyId === action.companyId &&
            this.convertedSharePurchase(state, action.playerId).details?.price ===
                action.expectedPrice
        )
    }

    private sale(
        state: State,
        action: CompanyAction & { shares: number; expectedProceeds: number }
    ): ShareSaleDetails | undefined {
        return this.convertedShareSales(state, action.playerId).find(
            (details) =>
                details.sales[0].companyId === action.companyId &&
                details.sales[0].shares === action.shares &&
                details.proceeds === action.expectedProceeds
        )
    }

    private passSharesValid(
        state: State,
        action: CompanyAction & { source: ActionSource }
    ): boolean {
        return (
            this.requireRound(state).conversion?.companyId === action.companyId &&
            this.currentTrader(state) === action.playerId &&
            (action.source === ActionSource.User ||
                !this.canTradeConvertedShares(state, action.playerId))
        )
    }

    private canBorrow(state: State, playerId: string): boolean {
        const conversion = this.requireRound(state).conversion
        return (
            !!conversion && canTakeLoan(state, this.rules.loanRules, playerId, conversion.companyId)
        )
    }

    private finishValid(state: S, action: CompanyAction & { source: ActionSource }): boolean {
        return (
            this.convertingCompanyFor(state, action.playerId) === action.companyId &&
            (action.source === ActionSource.User ||
                (!this.canBorrow(state, action.playerId) &&
                    !this.titleChoices(state, action.playerId, action.companyId).length))
        )
    }

    actions(): ActionDefinition[] {
        return ConversionRounds.actionsOf(this)
    }

    private static actionsOf<S extends HydratedSizedCompanyState>(
        rounds: ConversionRounds<S>
    ): ActionDefinition[] {
        const { market, conversions, stockRules, valuationRules } = rounds.rules

        class HydratedStartMergerRound
            extends StartMergerRoundAction.Base
            implements StartConversionRound
        {
            declare type: 'StartMergerRound'
            declare metadata?: StartConversionRound['metadata']
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.System && rounds.due(state),
                    'A merger round follows each operating round'
                )
                const set = state.operatingSet
                assertExists(set, 'A merger round follows an operating round')
                const companyIds = rounds.companyIds(state)
                state.mergerRound = {
                    set: set.number,
                    round: set.roundNumber,
                    companyIds,
                    closingZones: market.closingZones(state),
                    convertedIds: [],
                    completed: false
                }
                state.activePlayerIds = []
                this.metadata = { companyIds }
            }
        }

        class HydratedEndMergerRound
            extends EndMergerRoundAction.Base
            implements EndConversionRound
        {
            declare type: 'EndMergerRound'
            declare metadata?: EndConversionRound['metadata']
            apply(state: HydratedGameState & State): void {
                const round = rounds.requireRound(state)
                assert(
                    this.source === ActionSource.System &&
                        !round.companyIds.length &&
                        !round.conversion,
                    'The merger round ends once its companies are done'
                )
                round.completed = true
                state.activePlayerIds = []
                this.metadata = { roundEnd: roundEnd(state, valuationRules, 'title') }
            }
        }

        class HydratedConvertCompany extends ConvertCompanyAction.Base implements ConvertCompany {
            declare type: 'ConvertCompany'
            declare playerId: string
            declare companyId: string
            declare metadata?: ConvertCompany['metadata']
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.User && rounds.convertValid(state, this),
                    'Only the deciding company’s president may convert it'
                )
                const shareCount = conversions.sizeAfterConversion(state, this.companyId)
                const shareIds = conversions.convertCompany(state, this.companyId)
                const stationsOwed = conversions.stationsForConversion(state, this.companyId)
                rounds.beginConversion(state, {
                    companyId: this.companyId,
                    price: market.price(state, this.companyId),
                    stationsOwed
                })
                this.metadata = { shareIds, shareCount, stationsOwed }
            }
        }

        class HydratedMergeCompanies extends MergeCompaniesAction.Base implements MergeCompanies {
            declare type: 'MergeCompanies'
            declare playerId: string
            declare companyId: string
            declare targetId: string
            declare metadata?: MergeCompanies['metadata']
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.User && rounds.mergeValid(state, this),
                    'Only the deciding company’s president may merge it'
                )
                const record = conversions.mergeCompanies(state, this.companyId, this.targetId)
                const round = rounds.requireRound(state)
                dropCompany(round, this.targetId)
                conversions.rules.stations.trimStations(state, this.companyId)
                rounds.beginConversion(state, {
                    companyId: this.companyId,
                    merged: true,
                    price: record.price,
                    stationsOwed: 0
                })
                this.metadata = record
            }
        }

        class HydratedPassMerger extends PassMergerAction.Base implements PassConversion {
            declare type: 'PassMerger'
            declare playerId: string
            declare companyId: string
            apply(state: HydratedGameState & S): void {
                assert(
                    rounds.passValid(state, this),
                    'Only the deciding company’s president may pass'
                )
                dropCompany(rounds.requireRound(state), this.companyId)
            }
        }

        class HydratedBuyConvertedShare
            extends BuyConvertedShareAction.Base
            implements BuyConvertedShare
        {
            declare type: 'BuyConvertedShare'
            declare playerId: string
            declare companyId: string
            declare expectedPrice: number
            declare metadata?: SharePurchaseDetails
            apply(state: HydratedGameState & State): void {
                const { details, reason } = rounds.convertedSharePurchase(state, this.playerId)
                assert(
                    this.source === ActionSource.User && rounds.buyValid(state, this) && details,
                    reason ?? 'The share’s price has changed'
                )
                applyShareTransfer(state, details)
                if (conversions.presidentId(state, this.companyId) !== this.playerId)
                    rounds.requireConversion(state).traderIds.shift()
                this.metadata = details
            }
        }

        class HydratedSellConvertedShares
            extends SellConvertedSharesAction.Base
            implements SellConvertedShares
        {
            declare type: 'SellConvertedShares'
            declare playerId: string
            declare companyId: string
            declare shares: number
            declare expectedProceeds: number
            declare metadata?: ShareSaleDetails
            apply(state: HydratedGameState & State): void {
                const details = rounds.sale(state, this)
                assert(
                    this.source === ActionSource.User && details,
                    'Choose a legal post-conversion sale'
                )
                applyShareSale(state, details)
                stockRules.afterSale?.(state, details)
                rounds.requireConversion(state).traderIds.shift()
                this.metadata = details
            }
        }

        class HydratedPassConvertedShares
            extends PassConvertedSharesAction.Base
            implements PassConvertedShares
        {
            declare type: 'PassConvertedShares'
            declare playerId: string
            declare companyId: string
            apply(state: HydratedGameState & State): void {
                assert(
                    rounds.passSharesValid(state, this),
                    'Only the player whose turn it is may pass'
                )
                rounds.requireConversion(state).traderIds.shift()
            }
        }

        class HydratedFinishConversionLoans
            extends FinishConversionLoansAction.Base
            implements FinishConversionLoans
        {
            declare type: 'FinishConversionLoans'
            declare playerId: string
            declare companyId: string
            declare metadata?: FinishConversionLoans['metadata']
            apply(state: HydratedGameState & S): void {
                assert(
                    rounds.finishValid(state, this),
                    'Only the converted company’s president may finish'
                )
                const purchase = conversions.rules.stations.stationPurchase(
                    state,
                    this.companyId,
                    rounds.requireConversion(state).stationsOwed
                )
                delete rounds.requireRound(state).conversion
                if (!purchase.stations) {
                    this.metadata = { stations: 0 }
                    return
                }
                if (!purchase.affordable) {
                    this.metadata = {
                        stations: 0,
                        liquidation: market.liquidate(state, this.companyId)
                    }
                    return
                }
                const payment = {
                    from: { kind: 'company' as const, companyId: this.companyId },
                    to: { kind: 'bank' as const },
                    amount: purchase.cost
                }
                if (payment.amount) settleCashPayments(state, [payment])
                addCompanyStations(state, this.companyId, purchase.stations)
                this.metadata = {
                    stations: purchase.stations,
                    ...(payment.amount ? { payment } : {})
                }
            }
        }

        return [
            StartMergerRoundAction.define((action) => new HydratedStartMergerRound(action)),
            EndMergerRoundAction.define((action) => new HydratedEndMergerRound(action)),
            ConvertCompanyAction.define((action) => new HydratedConvertCompany(action)),
            MergeCompaniesAction.define((action) => new HydratedMergeCompanies(action)),
            PassMergerAction.define((action) => new HydratedPassMerger(action)),
            SellConvertedSharesAction.define((action) => new HydratedSellConvertedShares(action)),
            BuyConvertedShareAction.define((action) => new HydratedBuyConvertedShare(action)),
            PassConvertedSharesAction.define((action) => new HydratedPassConvertedShares(action)),
            FinishConversionLoansAction.define(
                (action) => new HydratedFinishConversionLoans(action)
            )
        ]
    }

    /** Opens the merger round once an operating round's companies and exports are done. */
    starts(handler: EighteenXXStateHandler<S>): EighteenXXStateHandler<S> {
        return new SystemActionFirstHandler(
            handler,
            StartConversionRound,
            (state) => (this.due(state) ? {} : undefined),
            'MergerRound'
        )
    }

    /** The round's machine states, each returning to `continuation` when the round ends. */
    stateHandlers(continuation: string): Record<string, EighteenXXStateHandler<S>> {
        return {
            MergerRound: this.decidingHandler(continuation),
            TradingConvertedShares: this.tradingHandler(),
            BorrowingAfterConversion: this.borrowingHandler()
        }
    }

    /** Each company in turn converts, merges or passes, until the round's companies are done. */
    private decidingHandler(continuation: string): EighteenXXStateHandler<S> {
        return {
            isValidAction: (action: HydratedAction, context: MachineContext<S>): boolean => {
                const state = context.gameState
                if (isEndConversionRound(action))
                    return (
                        action.source === ActionSource.System &&
                        !this.decidingCompanyId(state) &&
                        !this.requireRound(state).conversion
                    )
                if (isConvertCompany(action)) return this.convertValid(state, action)
                if (isMergeCompanies(action)) return this.mergeValid(state, action)
                if (isPassConversion(action)) return this.passValid(state, action)
                const companyId = this.decidingCompanyId(state)
                return (
                    !!companyId &&
                    action.source === ActionSource.User &&
                    !!action.playerId &&
                    this.decidesFor(state, action.playerId, companyId) &&
                    !!actingCompanyAction(this.companyActions, action, state, companyId)
                )
            },
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] => {
                const state = context.gameState
                const companyId = this.decidingCompanyId(state)
                return companyId && this.decidesFor(state, playerId, companyId)
                    ? [
                          ...this.mergerOptions(state, companyId),
                          'PassMerger',
                          ...this.titleChoices(state, playerId, companyId)
                      ]
                    : []
            },
            enter: (context: MachineContext<S>): void => {
                const state = context.gameState
                const companyId = this.decidingCompanyId(state)
                if (!companyId) {
                    context.addSystemAction(EndConversionRound, {})
                    return
                }
                const playerId = this.rules.conversions.presidentId(state, companyId)
                state.activePlayerIds = [playerId]
                if (
                    !this.mergerOptions(state, companyId).length &&
                    !this.titleChoices(state, playerId, companyId).length
                )
                    context.addSystemAction(PassConversion, { playerId, companyId })
            },
            onAction: (action: HydratedAction, context: MachineContext<S>): string => {
                if (isEndConversionRound(action)) return continuation
                return this.stateAfterConversion(context.gameState)
            }
        }
    }

    /** The president buys; other shareholders may buy once, sell a block, or pass. */
    private tradingHandler(): EighteenXXStateHandler<S> {
        return {
            isValidAction: (action: HydratedAction, context: MachineContext<S>): boolean => {
                const state = context.gameState
                if (isBuyConvertedShare(action)) return this.buyValid(state, action)
                if (isSellConvertedShares(action))
                    return action.source === ActionSource.User && !!this.sale(state, action)
                if (isPassConvertedShares(action)) return this.passSharesValid(state, action)
                return false
            },
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] => {
                const state = context.gameState
                if (this.currentTrader(state) !== playerId) return []
                return [
                    ...(this.convertedSharePurchase(state, playerId).details
                        ? ['BuyConvertedShare']
                        : []),
                    ...(this.convertedShareSales(state, playerId).length
                        ? ['SellConvertedShares']
                        : []),
                    'PassConvertedShares'
                ]
            },
            enter: (context: MachineContext<S>): void => {
                const state = context.gameState
                const conversion = this.requireConversion(state)
                const playerId = this.currentTrader(state)
                assertExists(playerId, 'A player is trading')
                state.activePlayerIds = [playerId]
                if (!this.canTradeConvertedShares(state, playerId))
                    context.addSystemAction(PassConvertedShares, {
                        playerId,
                        companyId: conversion.companyId
                    })
            },
            onAction: (_action: HydratedAction, context: MachineContext<S>): string =>
                this.stateAfterConversion(context.gameState)
        }
    }

    /** The converted company may borrow, then buys the stations its size needs. */
    private borrowingHandler(): EighteenXXStateHandler<S> {
        return {
            isValidAction: (action: HydratedAction, context: MachineContext<S>): boolean => {
                const state = context.gameState
                if (isTakeLoan(action))
                    return (
                        action.source === ActionSource.User &&
                        this.requireRound(state).conversion?.companyId === action.companyId &&
                        this.canBorrow(state, action.playerId)
                    )
                if (isFinishConversionLoans(action)) return this.finishValid(state, action)
                const companyId = action.playerId
                    ? this.convertingCompanyFor(state, action.playerId)
                    : undefined
                return (
                    !!companyId &&
                    action.source === ActionSource.User &&
                    !!actingCompanyAction(this.companyActions, action, state, companyId)
                )
            },
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] => {
                const state = context.gameState
                const companyId = this.convertingCompanyFor(state, playerId)
                if (!companyId) return []
                return [
                    ...(this.canBorrow(state, playerId) ? ['TakeLoan'] : []),
                    'FinishConversionLoans',
                    ...this.titleChoices(state, playerId, companyId)
                ]
            },
            enter: (context: MachineContext<S>): void => {
                const state = context.gameState
                const conversion = this.requireConversion(state)
                const playerId = this.rules.conversions.presidentId(state, conversion.companyId)
                state.activePlayerIds = [playerId]
                if (
                    !this.canBorrow(state, playerId) &&
                    !this.titleChoices(state, playerId, conversion.companyId).length
                )
                    context.addSystemAction(FinishConversionLoans, {
                        playerId,
                        companyId: conversion.companyId
                    })
            },
            onAction: (action: HydratedAction): string =>
                isFinishConversionLoans(action) ? 'MergerRound' : 'BorrowingAfterConversion'
        }
    }
}
