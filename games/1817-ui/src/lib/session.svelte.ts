import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from '@tabletop/1817'
import {
    AcquireCompany,
    AcquisitionRoundStates,
    BidToAcquire,
    BuyBackShares,
    CompanyExcessStates,
    DeclineOffer,
    FinishAcquisitionLoans,
    OfferCompany,
    PassOnCompany,
    RepayAcquiredLoan,
    acquirerChoice,
    acquisitionRoundCompanyId,
    activeAcquisitionRound,
    excessCompanyId,
    minimumBid,
    openingBid,
    bidCeiling,
    BuyConvertedShare,
    ConvertCompany,
    DiscardMergedTrain,
    EighteenSeventeenTitleRules,
    FinishConversionLoans,
    MergeCompanies,
    PassConvertedShares,
    PassMerger,
    RemoveStation,
    ShortShare,
    activeMergerRound,
    convertedSharePurchase,
    corporateActionOptions,
    discardableTrains,
    mergeTargetIds,
    mergerPreview,
    mergerRoundCompanyId,
    removableStations,
    shortOptions,
    conversionPreview,
    buyersFor,
    stationPurchase,
    treasuryShareIds,
    SellConvertedShares,
    convertedShareSales
} from '@tabletop/1817'
import { assert } from '@tabletop/common'
import { PassableBidding } from '@tabletop/18xx'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import { EighteenSeventeenMapView } from './mapView.js'
import { EighteenSeventeenPresentation } from './presentation.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<
        typeof EighteenSeventeenState,
        HydratedEighteenSeventeenState
    >
> = createEighteenXXSessionClass(
    EighteenSeventeenTitleRules,
    EighteenSeventeenMapView,
    EighteenSeventeenPresentation
)

/** The stock-round panels 1817 adds beside Buy and Sell. */
export type StockPanel = 'company' | 'short'

export class EighteenSeventeenSession extends BaseSession {
    private chosenStockPanel = $state<StockPanel>()
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register(
            {
                hasManual: () => !!this.chosenStockPanel,
                undo: () => {
                    if (!this.chosenStockPanel) return false
                    this.chosenStockPanel = undefined
                    return true
                },
                clear: () => {
                    this.chosenStockPanel = undefined
                }
            },
            'first'
        )
    }
    override get additionalStockMenuCount() {
        return (this.corporateActions.length ? 1 : 0) + (this.shorts.length ? 1 : 0)
    }
    /** The open 1817 stock panel; while acting for a company, only its panel remains. */
    stockPanel = $derived.by((): StockPanel | undefined => {
        if (this.stock.openMenu) return undefined
        if (this.gameState.stockRound.turn.corporateAction && this.corporateActions.length)
            return 'company'
        if (this.chosenStockPanel === 'company' && this.corporateActions.length) return 'company'
        if (this.chosenStockPanel === 'short' && this.shorts.length) return 'short'
        return undefined
    })
    chooseStockPanel(panel: StockPanel) {
        this.stock.chooseMenu(undefined)
        this.chosenStockPanel = panel
    }
    protected override onStockSelectionCancelled() {
        this.chosenStockPanel = undefined
    }
    corporateActions = $derived.by(() => {
        const playerId = this.gameState.activePlayerIds[0]
        return playerId &&
            (this.validActionTypes.includes('TakeLoan') ||
                this.validActionTypes.includes('BuyBackShares'))
            ? corporateActionOptions(this.gameState, playerId)
            : []
    })
    shorts = $derived.by(() => {
        const playerId = this.gameState.activePlayerIds[0]
        return playerId && this.validActionTypes.includes('ShortShare')
            ? shortOptions(this.gameState, playerId)
            : []
    })
    mergerCompanyId = $derived(mergerRoundCompanyId(this.gameState))
    mergerDecision = $derived.by(() => {
        const companyId = this.mergerCompanyId
        const state = this.gameState
        if (!companyId || !this.validActionTypes.includes('PassMerger')) return undefined
        const round = activeMergerRound(state)
        assert(round, 'A merger round is in progress')
        return {
            conversion: this.validActionTypes.includes('ConvertCompany')
                ? conversionPreview(state, companyId)
                : undefined,
            targets: this.validActionTypes.includes('MergeCompanies')
                ? mergeTargetIds(state, companyId, round.convertedIds).map((targetId) => ({
                      companyId: targetId,
                      preview: mergerPreview(state, companyId, targetId)
                  }))
                : []
        }
    })
    convertedShareTrading = $derived.by(() => {
        const state = this.gameState
        const conversion = activeMergerRound(state)?.conversion
        if (state.machineState !== 'TradingConvertedShares' || !conversion) return undefined
        const playerId = state.activePlayerIds[0]
        return {
            price: conversion.price,
            remaining: treasuryShareIds(state, conversion.companyId).length,
            traderIds: conversion.traderIds,
            sales:
                playerId && this.validActionTypes.includes('SellConvertedShares')
                    ? convertedShareSales(state, playerId)
                    : [],
            purchase:
                playerId && this.validActionTypes.includes('BuyConvertedShare')
                    ? convertedSharePurchase(state, playerId).details
                    : undefined
        }
    })
    conversionStations = $derived.by(() => {
        const state = this.gameState
        const conversion = activeMergerRound(state)?.conversion
        return state.machineState === 'BorrowingAfterConversion' && conversion
            ? stationPurchase(state, conversion.companyId, conversion.stationsOwed)
            : undefined
    })
    companyExcess = $derived.by(() => {
        const state = this.gameState
        const companyId = excessCompanyId(state)
        if (!companyId || !CompanyExcessStates.some((name) => name === state.machineState))
            return undefined
        return {
            companyId,
            stations: removableStations(state, companyId),
            trains: discardableTrains(state, companyId)
        }
    })
    acquisitionCompanyId = $derived(
        AcquisitionRoundStates.some((name) => name === this.gameState.machineState)
            ? acquisitionRoundCompanyId(this.gameState)
            : undefined
    )
    /** The companies the acquisition round has still to offer after the current one. */
    acquisitionQueue = $derived.by(() => {
        const companyId = this.acquisitionCompanyId
        if (!companyId) return []
        const round = activeAcquisitionRound(this.gameState)
        assert(round, 'An acquisition round is in progress')
        return round.companyIds.filter((id) => id !== companyId)
    })
    acquisitionOffer = $derived.by(() => {
        const companyId = this.acquisitionCompanyId
        return companyId && this.validActionTypes.includes('OfferCompany')
            ? { openingBid: openingBid(this.gameState, companyId, 'offered') }
            : undefined
    })
    companySale = $derived.by(() => {
        const state = this.gameState
        const sale = activeAcquisitionRound(state)?.sale
        if (!sale || state.machineState !== 'AcquisitionBidding') return undefined
        const bidding = new PassableBidding(sale.bidding)
        const playerId = state.activePlayerIds[0]
        return {
            kind: sale.kind,
            highBid: bidding.hasBid
                ? { playerId: bidding.highBidderId, amount: bidding.highBid }
                : undefined,
            minimum: minimumBid(state, sale),
            maximum:
                playerId && this.validActionTypes.includes('BidToAcquire')
                    ? bidCeiling(state, sale, playerId)
                    : undefined,
            /** The bidder's companies that could pay this amount. */
            payers: (amount: number) => (playerId ? buyersFor(state, playerId, sale, amount) : [])
        }
    })
    acquirerChoice = $derived(
        this.validActionTypes.includes('AcquireCompany')
            ? acquirerChoice(this.gameState)
            : undefined
    )
    buyerLoans = $derived.by(() => {
        const acquisition = activeAcquisitionRound(this.gameState)?.acquisition
        if (this.gameState.machineState !== 'AcquisitionLoans' || !acquisition) return undefined
        const { buyerId, price, inheritedLoans, repaidLoans } = acquisition
        return { buyerId, price, inheritedLoans, repaidLoans }
    })
    private requireAcquisitionCompanyId(): string {
        const companyId = this.acquisitionCompanyId
        assert(companyId, 'An acquisition round is in progress')
        return companyId
    }
    async offerCompany() {
        await this.applyAction(
            this.createPlayerAction(OfferCompany, { companyId: this.requireAcquisitionCompanyId() })
        )
    }
    async declineOffer() {
        await this.applyAction(
            this.createPlayerAction(DeclineOffer, { companyId: this.requireAcquisitionCompanyId() })
        )
    }
    async bidToAcquire(amount: number) {
        await this.applyAction(
            this.createPlayerAction(BidToAcquire, {
                companyId: this.requireAcquisitionCompanyId(),
                amount
            })
        )
    }
    async passOnCompany() {
        await this.applyAction(
            this.createPlayerAction(PassOnCompany, {
                companyId: this.requireAcquisitionCompanyId()
            })
        )
    }
    async acquireCompany(buyerId: string) {
        await this.applyAction(
            this.createPlayerAction(AcquireCompany, {
                companyId: this.requireAcquisitionCompanyId(),
                buyerId
            })
        )
    }
    private requireBuyerId(): string {
        const buyerId = this.buyerLoans?.buyerId
        assert(buyerId, 'A company has been bought')
        return buyerId
    }
    async repayAcquiredLoan() {
        await this.applyAction(
            this.createPlayerAction(RepayAcquiredLoan, { companyId: this.requireBuyerId() })
        )
    }
    async finishAcquisitionLoans() {
        await this.applyAction(
            this.createPlayerAction(FinishAcquisitionLoans, { companyId: this.requireBuyerId() })
        )
    }
    private requireMergerCompanyId(): string {
        const companyId = this.mergerCompanyId
        assert(companyId, 'A merger round is in progress')
        return companyId
    }
    async convertCompany() {
        await this.applyAction(
            this.createPlayerAction(ConvertCompany, { companyId: this.requireMergerCompanyId() })
        )
    }
    async mergeCompanies(targetId: string) {
        await this.applyAction(
            this.createPlayerAction(MergeCompanies, {
                companyId: this.requireMergerCompanyId(),
                targetId
            })
        )
    }
    async passMerger() {
        await this.applyAction(
            this.createPlayerAction(PassMerger, { companyId: this.requireMergerCompanyId() })
        )
    }
    async buyConvertedShare() {
        const purchase = this.convertedShareTrading?.purchase
        assert(purchase, 'The player cannot buy a converted share now')
        await this.applyAction(
            this.createPlayerAction(BuyConvertedShare, {
                companyId: purchase.companyId,
                expectedPrice: purchase.price
            })
        )
    }
    async sellConvertedShares(shares: number) {
        const sale = this.convertedShareTrading?.sales.find(
            (sale) => sale.sales[0].shares === shares
        )
        assert(sale, 'The player cannot sell this block now')
        await this.applyAction(
            this.createPlayerAction(SellConvertedShares, {
                companyId: sale.sales[0].companyId,
                shares,
                expectedProceeds: sale.proceeds
            })
        )
    }
    async passConvertedShares() {
        await this.applyAction(
            this.createPlayerAction(PassConvertedShares, {
                companyId: this.requireMergerCompanyId()
            })
        )
    }
    async finishConversionLoans() {
        await this.applyAction(
            this.createPlayerAction(FinishConversionLoans, {
                companyId: this.requireMergerCompanyId()
            })
        )
    }
    private requireExcessCompanyId(): string {
        const companyId = this.companyExcess?.companyId
        assert(companyId, 'A company is over its limits')
        return companyId
    }
    async removeStation(stationId: string) {
        await this.applyAction(
            this.createPlayerAction(RemoveStation, {
                companyId: this.requireExcessCompanyId(),
                stationId
            })
        )
    }
    async discardMergedTrain(trainId: string) {
        await this.applyAction(
            this.createPlayerAction(DiscardMergedTrain, {
                companyId: this.requireExcessCompanyId(),
                trainId
            })
        )
    }
    async shortShare(companyId: string) {
        const option = this.shorts.find((option) => option.companyId === companyId)
        assert(option, 'This company cannot be shorted now')
        await this.applyAction(
            this.createPlayerAction(ShortShare, { companyId, expectedPrice: option.price })
        )
    }
    async buyBackShare(companyId: string) {
        const buyBack = this.corporateActions.find(
            (option) => option.companyId === companyId
        )?.buyBack
        assert(
            buyBack && this.validActionTypes.includes('BuyBackShares'),
            'The company cannot buy back a share now'
        )
        await this.applyAction(
            this.createPlayerAction(BuyBackShares, {
                companyId,
                certificateIds: [buyBack.certificateId]
            })
        )
    }
}

export function requireEighteenSeventeenSession(session: unknown): EighteenSeventeenSession {
    assert(session instanceof EighteenSeventeenSession, 'Expected a 1817 session')
    return session
}
