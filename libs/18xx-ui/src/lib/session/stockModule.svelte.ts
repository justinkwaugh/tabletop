import { assert, assertExists } from '@tabletop/common'
import {
    BuyShares,
    FinishStockTurn,
    SellShares,
    StartCompany,
    evaluateCompanyStart,
    evaluateSharePurchase,
    evaluateShareSale,
    exceedsStockLimits,
    flotationAfterPurchase,
    isBuyShares,
    isCompleteStockRound,
    isFinishStockTurn,
    isFloatCompany,
    isSellShares,
    isStartCompany,
    isStartOperatingSet,
    sameOwner,
    sharesOwned,
    type CompanyStartRequest,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type Owner,
    type PurchaseRequest,
    type SaleRequest,
    type ShareSale
} from '@tabletop/18xx'
import {
    StockActionStageOrder,
    type StockAction,
    type StockActionStages
} from '../stock/stockActionSelection.js'
import { CompanyStartStageOrder, type CompanyStartStages } from './companyStartSelection.js'
import type { LocalSelection } from './localSelections.js'
import type { ModuleSession } from './moduleSession.js'
import { StagedSelection, singleChoice } from './stagedSelection.svelte.js'

export type StockTrade =
    | { kind: 'purchase'; request: PurchaseRequest }
    | { kind: 'sale'; request: SaleRequest }

type StockState = Parameters<typeof evaluateCompanyStart>[0] &
    Parameters<typeof evaluateSharePurchase>[0] &
    Parameters<typeof evaluateShareSale>[0] &
    Parameters<typeof flotationAfterPurchase>[0] &
    Parameters<typeof exceedsStockLimits>[0] &
    Pick<EighteenXXState, 'machineState' | 'stockRound' | 'activePlayerIds'>

export type StockSession = ModuleSession<
    StockState,
    Pick<EighteenXXTitleRules, 'stockRules' | 'companyRules'>
>

export class StockModule implements LocalSelection {
    readonly menu = new StagedSelection<StockActionStages>(StockActionStageOrder, 'pop-stage')
    readonly trade = singleChoice<StockTrade>()
    readonly start = new StagedSelection<CompanyStartStages>(CompanyStartStageOrder, 'pop-stage')
    constructor(
        private readonly session: StockSession,
        private readonly onCancel: () => void
    ) {}

    private trading = $derived.by(
        () =>
            this.session.selectionsVisible && this.session.state.machineState === 'StockRound'
    )
    openMenu = $derived.by(() =>
        this.session.selectionsVisible ? this.menu.value('action')?.menu : undefined
    )
    menuBuyer = $derived.by(() => this.menu.value('action')?.buyer)
    selectedSaleCompany = $derived.by(() => this.menu.value('saleCompany'))
    get hasSelection() {
        return this.trade.hasManual() || this.start.hasManual()
    }

    startChoices = $derived.by(() => {
        const { state, rules, playerId } = this.session
        if (!playerId || !this.trading || state.stockRound.turn.bought) return []
        return rules.stockRules.buyers(state, playerId).flatMap((buyer) =>
            state.companies
                .filter((company) => !company.started && !company.closed && company.shareCount)
                .map((company) => {
                    const request = { playerId, buyer, companyId: company.id }
                    const prices = rules.companyRules
                        .startMarketSpaces(state, company.id)
                        .map((marketSpaceId) => ({
                            marketSpaceId,
                            result: evaluateCompanyStart(
                                state,
                                { ...request, marketSpaceId },
                                rules.stockRules,
                                rules.companyRules
                            )
                        }))
                    return { request, prices }
                })
                .filter((choice) => choice.prices.length > 0)
        )
    })
    selectedStartCompany = $derived.by(() =>
        this.session.selectionsVisible ? this.start.value('company') : undefined
    )
    private selectedStartRequest = $derived.by((): CompanyStartRequest | undefined => {
        const company = this.selectedStartCompany
        const marketSpaceId = this.start.value('marketSpaceId')
        return company && marketSpaceId ? { ...company, marketSpaceId } : undefined
    })
    selectedStartPrices = $derived.by(() => {
        const company = this.selectedStartCompany
        return (
            this.startChoices.find(
                (choice) =>
                    company &&
                    choice.request.companyId === company.companyId &&
                    sameOwner(choice.request.buyer, company.buyer)
            )?.prices ?? []
        )
    })
    selectedStartResult = $derived.by(() =>
        this.selectedStartRequest
            ? evaluateCompanyStart(
                  this.session.state,
                  this.selectedStartRequest,
                  this.session.rules.stockRules,
                  this.session.rules.companyRules
              )
            : undefined
    )

    purchaseChoices = $derived.by(() => {
        const { state, rules, playerId } = this.session
        if (!playerId || !this.trading || state.stockRound.turn.bought) return []
        return rules.stockRules.buyers(state, playerId).flatMap((buyer) =>
            state.certificates
                .filter((certificate) => !certificate.retired)
                .filter(
                    (certificate) =>
                        certificate.kind === 'share' && certificate.poolId !== undefined
                )
                .map((certificate) => {
                    const request = { playerId, buyer, certificateId: certificate.id }
                    return {
                        certificate,
                        request,
                        result: evaluateSharePurchase(state, request, rules.stockRules)
                    }
                })
        )
    })
    saleChoices = $derived.by(() => {
        const { state, rules, playerId } = this.session
        if (!playerId || !this.trading) return []
        return rules.stockRules.sellers(state, playerId).flatMap((seller) =>
            state.companies.flatMap((company) => {
                const owned = sharesOwned(state, company.id, seller)
                return Array.from({ length: owned }, (_, index) => {
                    const sale = { companyId: company.id, shares: index + 1 }
                    const request = { playerId, seller, sales: [sale] }
                    return { sale, request, result: evaluateShareSale(state, request, rules.stockRules) }
                })
            })
        )
    })
    private visibleTrade = $derived.by(() =>
        this.session.selectionsVisible ? this.trade.value('choice') : undefined
    )
    selectedPurchaseDetails = $derived.by(() =>
        this.visibleTrade?.kind === 'purchase'
            ? evaluateSharePurchase(
                  this.session.state,
                  this.visibleTrade.request,
                  this.session.rules.stockRules
              ).details
            : undefined
    )
    selectedPurchaseFlotation = $derived.by(() =>
        this.selectedPurchaseDetails
            ? flotationAfterPurchase(
                  this.session.state,
                  this.selectedPurchaseDetails,
                  this.session.rules.companyRules
              )
            : undefined
    )
    private saleSelection = $derived.by(() => {
        if (!this.session.selectionsVisible) return undefined
        if (this.visibleTrade?.kind === 'sale')
            return { source: 'manual' as const, request: this.visibleTrade.request }
        if (this.openMenu !== 'sell' || !this.selectedSaleCompany) return undefined
        const choices = this.saleChoices.filter(
            (choice) =>
                choice.sale.companyId === this.selectedSaleCompany && choice.result.details
        )
        return choices.length === 1 && choices[0].sale.shares === 1
            ? { source: 'auto' as const, request: choices[0].request }
            : undefined
    })
    selectedSale = $derived.by(() => this.saleSelection?.request)
    selectedSaleResult = $derived.by(() =>
        this.selectedSale
            ? evaluateShareSale(
                  this.session.state,
                  this.selectedSale,
                  this.session.rules.stockRules
              )
            : undefined
    )
    trades = $derived.by(() =>
        this.session.recordedActions.filter(
            (action) =>
                isBuyShares(action) ||
                isSellShares(action) ||
                isStartCompany(action) ||
                isFloatCompany(action) ||
                isFinishStockTurn(action) ||
                isCompleteStockRound(action) ||
                isStartOperatingSet(action)
        )
    )
    turnSales = $derived.by(() => {
        const boundary = this.trades.findLastIndex(
            (action) => isFinishStockTurn(action) || isCompleteStockRound(action)
        )
        const totals = new Map<string, number>()
        for (const action of this.trades.slice(boundary + 1)) {
            if (!isSellShares(action)) continue
            for (const sale of action.sales)
                totals.set(sale.companyId, (totals.get(sale.companyId) ?? 0) + sale.shares)
        }
        return [...totals].map(([companyId, shares]) => ({ companyId, shares }))
    })
    mustSell = $derived.by(() =>
        this.session.state.machineState === 'StockRound' && this.session.playerId
            ? exceedsStockLimits(
                  this.session.state,
                  { kind: 'player', playerId: this.session.playerId },
                  this.session.rules.stockRules
              )
            : false
    )

    chooseMenu(menu: StockAction | undefined, buyer?: Owner) {
        this.assertAvailable(this.session.playerId)
        this.cancel()
        this.menu.clear()
        if (menu) this.menu.choose('action', { menu, ...(buyer ? { buyer } : {}) })
    }
    chooseSaleCompany(companyId: string) {
        this.assertAvailable(this.session.playerId)
        this.menu.choose('saleCompany', companyId)
    }
    selectCompanyStart(request: CompanyStartStages['company']) {
        this.assertAvailable(request.playerId)
        this.trade.clear()
        this.start.clear()
        this.start.choose('company', request)
    }
    selectStartPrice(marketSpaceId: string) {
        this.assertAvailable(this.session.playerId)
        assert(this.start.value('company'), 'Choose a company before its starting price')
        this.start.choose('marketSpaceId', marketSpaceId)
    }
    backFromStart() {
        assert(this.start.value('company'), 'No company start selected')
        this.start.back()
    }
    selectPurchase(request: PurchaseRequest) {
        this.assertAvailable(request.playerId)
        assert(
            evaluateSharePurchase(this.session.state, request, this.session.rules.stockRules)
                .details,
            'Purchase is unavailable'
        )
        this.start.clear()
        this.trade.choose('choice', { kind: 'purchase', request })
    }
    selectSale(request: SaleRequest) {
        this.assertAvailable(request.playerId)
        assert(request.sales.length === 1, 'Select one company per sale')
        this.start.clear()
        this.trade.choose('choice', { kind: 'sale', request })
    }
    removeSale(companyId: string) {
        const trade = this.trade.value('choice')
        if (trade?.kind !== 'sale') return
        const sales = trade.request.sales.filter((sale) => sale.companyId !== companyId)
        if (sales.length) this.trade.choose('choice', { kind: 'sale', request: { ...trade.request, sales } })
        else this.trade.clear()
    }
    cancel() {
        this.trade.clear()
        this.start.clear()
        this.onCancel()
    }
    async confirmStart() {
        this.assertAvailable(this.session.playerId)
        const details = this.selectedStartResult?.details
        assertExists(details, 'Choose an available company and starting price')
        await this.session.applyAction(
            this.session.createPlayerAction(StartCompany, {
                buyer: details.buyer,
                companyId: details.companyId,
                marketSpaceId: details.marketSpaceId,
                expectedPrice: details.price
            })
        )
    }
    async confirmPurchase() {
        this.assertAvailable(this.session.playerId)
        const details = this.selectedPurchaseDetails
        assertExists(details, 'Select an available purchase')
        await this.session.applyAction(
            this.session.createPlayerAction(BuyShares, {
                buyer: details.buyer,
                certificateId: details.certificateId,
                expectedPrice: details.price
            })
        )
    }
    async confirmSale() {
        this.assertAvailable(this.session.playerId)
        const playerId = this.session.playerId
        const roundNumber = this.session.state.stockRound.number
        const details = this.selectedSaleResult?.details
        assertExists(details, 'Select an available sale')
        const sales: ShareSale[] = details.sales.map(({ companyId, shares }) => ({
            companyId,
            shares
        }))
        await this.session.applyAction(
            this.session.createPlayerAction(SellShares, {
                seller: details.seller,
                sales,
                expectedProceeds: details.proceeds
            })
        )
        await this.session.settled()
        if (
            playerId &&
            this.session.playerId === playerId &&
            this.session.state.activePlayerIds.includes(playerId) &&
            !this.session.viewingHistory &&
            this.session.state.stockRound.number === roundNumber &&
            this.saleChoices.some((choice) => choice.result.details)
        ) {
            this.menu.clear()
            this.menu.choose('action', { menu: 'sell' }, 'auto')
        }
    }
    async finishTurn() {
        this.assertAvailable(this.session.playerId)
        assert(
            !this.hasSelection && this.session.validActionTypes.includes('FinishStockTurn'),
            'Finish the current selection first'
        )
        await this.session.applyAction(this.session.createPlayerAction(FinishStockTurn, {}))
    }

    hasManual() {
        return this.hasSelection || this.menu.hasManual()
    }
    undo() {
        if (this.openMenu === 'sell' && this.selectedSaleCompany) {
            this.cancel()
            this.menu.back()
            return true
        }
        if (this.trade.hasManual()) {
            this.cancel()
            return true
        }
        if (this.start.undo()) return true
        if (this.menu.entry('action')?.source !== 'manual') return false
        this.menu.back()
        return true
    }
    clear() {
        this.cancel()
        this.menu.clear()
    }

    private assertAvailable(playerId: string | undefined) {
        assert(this.session.interactive, 'Stock selection is unavailable')
        assert(
            playerId !== undefined && playerId === this.session.playerId,
            'Select a trade for the acting player'
        )
    }
}
