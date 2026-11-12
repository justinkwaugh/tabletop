import { assert, assertExists, type GameAction } from '@tabletop/common'
import {
    BuyShares,
    awardParSpaces,
    FinishStockTurn,
    OfferPrivatePurchase,
    ParCompany,
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
    privateSaleChoices,
    privateSaleOfferReason,
    suggestedPrivateSalePrice,
    sameCenter,
    sameOwner,
    sharesOwned,
    type CompanyStartDetails,
    type CompanyStartRequest,
    type EighteenXXState,
    type HomePosition,
    type StartHome,
    type EighteenXXTitleRules,
    type Owner,
    type PurchaseRequest,
    type SaleRequest,
    type StationReservation,
    type ShareSale,
    type ShareSaleDetails,
    type ShareCertificate,
    type SharePurchaseDetails,
    type ValuationRules,
    companyShareCount,
    stationReservation
} from '@tabletop/18xx'
import {
    StockActionStageOrder,
    type StockAction,
    type StockActionStages
} from '../stock/stockActionSelection.js'
import { distinctOwners, sameCertificateOffer } from '../stock/purchaseSources.js'
import { CompanyStartStageOrder, type CompanyStartStages } from './companyStartSelection.js'
import type { LocalSelection } from '@tabletop/frontend-components'
import type { ModuleSession } from './moduleSession.js'
import { StagedSelection, singleChoice } from './stagedSelection.svelte.js'

export type StockTrade =
    { kind: 'purchase'; request: PurchaseRequest } | { kind: 'sale'; request: SaleRequest }

export type AvailablePurchase = {
    certificate: ShareCertificate
    request: PurchaseRequest
    details: SharePurchaseDetails
}
export type CompanyShareOffer = { certificate: ShareCertificate; purchases: AvailablePurchase[] }
export type CompanyShareSale = { request: SaleRequest; shares: number; proceeds: number }
export type CompanyShareSales = { seller: Owner; sales: CompanyShareSale[] }
export type CompanyTrades = {
    buyers: Owner[]
    offers: CompanyShareOffer[]
    sales: CompanyShareSales[]
}

type StockState = Parameters<typeof evaluateCompanyStart>[0] &
    Parameters<typeof evaluateSharePurchase>[0] &
    Parameters<typeof evaluateShareSale>[0] &
    Parameters<typeof flotationAfterPurchase>[0] &
    Parameters<typeof exceedsStockLimits>[0] &
    Pick<
        EighteenXXState,
        'machineState' | 'stockRound' | 'activePlayerIds' | 'purchaseOffer' | 'pendingPar'
    >

export type StockSession = ModuleSession<
    StockState,
    Pick<EighteenXXTitleRules, 'stockRules' | 'companyRules'> & { endingRules: ValuationRules }
>

export class StockModule implements LocalSelection {
    readonly menu = new StagedSelection<StockActionStages>(StockActionStageOrder, 'pop-stage')
    readonly trade = singleChoice<StockTrade>()
    readonly start = new StagedSelection<CompanyStartStages>(CompanyStartStageOrder, 'pop-stage')
    constructor(
        private readonly session: StockSession,
        private readonly onCancel: () => void,
        private readonly exchangeAvailable: () => boolean = () => false
    ) {}

    private trading = $derived.by(
        () =>
            this.session.selectionsVisible &&
            this.session.state.machineState === 'StockRound' &&
            !this.session.state.purchaseOffer
    )
    availableMenus = $derived.by(() => {
        const choices: StockActionStages['action'][] = []
        const purchase = this.purchaseChoices.find((choice) => choice.result.details)
        if (purchase) choices.push({ menu: 'buy', buyer: purchase.request.buyer })
        if (this.saleChoices.some((choice) => choice.result.details)) choices.push({ menu: 'sell' })
        const start = this.startChoices.find((choice) =>
            choice.prices.some((price) => price.result.details)
        )
        if (start) choices.push({ menu: 'start', buyer: start.request.buyer })
        if (this.trading && this.session.validActionTypes.includes('AuctionCompany'))
            choices.push({ menu: 'auction' })
        if (this.exchangeAvailable()) choices.push({ menu: 'exchange' })
        if (this.privateChoices.length) choices.push({ menu: 'privates' })
        return choices
    })
    private menuSelection = $derived.by(() =>
        this.trading ? this.menu.entry('action') : undefined
    )
    openMenu = $derived.by(() => this.menuSelection?.value.menu)
    menuBuyer = $derived.by(() => this.menuSelection?.value.buyer)
    selectedSaleCompany = $derived.by(() => this.menu.value('saleCompany'))
    get hasSelection() {
        return this.trade.hasManual() || this.start.hasManual()
    }

    private unstartedCompanies() {
        const { state, rules } = this.session
        return state.companies.filter(
            (company) =>
                !company.started &&
                !company.closed &&
                companyShareCount(state, rules.stockRules.charters, company.id)
        )
    }
    private auctionsCompanies = $derived.by(() => !!this.session.rules.stockRules.companyAuction)
    canStartCompanies = $derived.by(
        () => this.trading && !this.auctionsCompanies && this.unstartedCompanies().length > 0
    )
    canAuctionCompanies = $derived.by(
        () => this.trading && this.auctionsCompanies && this.unstartedCompanies().length > 0
    )

    private startHomes(companyId: string, marketSpaceId: string): StartHome[] | undefined {
        return this.session.rules.companyRules.startHomes?.(
            this.session.state,
            companyId,
            marketSpaceId
        )
    }
    /**
     * The home a start at this price would use: the chosen one, or before a choice the cheapest,
     * so a price is offered when some home makes it possible.
     */
    private startHome(companyId: string, marketSpaceId: string): HomePosition | undefined {
        const homes = this.startHomes(companyId, marketSpaceId)
        if (!homes) return undefined
        const chosen = this.selectedStartHome
        if (chosen && this.selectedStartCompany?.companyId === companyId) return chosen
        const cheapest = homes.toSorted((a, b) => a.cost - b.cost)[0]
        return cheapest ? { locationId: cheapest.locationId, nodeId: cheapest.nodeId } : undefined
    }
    startChoices = $derived.by(() => {
        const { state, rules, playerId } = this.session
        if (!playerId || !this.trading || state.stockRound.turn.bought) return []
        return rules.stockRules.buyers(state, playerId).flatMap((buyer) =>
            this.unstartedCompanies()
                .map((company) => {
                    const request = { playerId, buyer, companyId: company.id }
                    const prices = rules.companyRules
                        .startMarketSpaces(state, company.id)
                        .map((marketSpaceId) => {
                            const home = this.startHome(company.id, marketSpaceId)
                            return {
                                marketSpaceId,
                                result: evaluateCompanyStart(
                                    state,
                                    { ...request, marketSpaceId, ...(home ? { home } : {}) },
                                    rules.stockRules,
                                    rules.companyRules
                                )
                            }
                        })
                    return { request, prices }
                })
                .filter((choice) => choice.prices.length > 0)
        )
    })
    selectedStartCompany = $derived.by(() =>
        this.session.selectionsVisible ? this.start.value('company') : undefined
    )
    selectedStartHome = $derived.by(() =>
        this.session.selectionsVisible ? this.start.value('home') : undefined
    )
    /** Every city offered for the chosen company's home, at any of its prices. */
    private offeredStartHomes = $derived.by((): StartHome[] => {
        const company = this.selectedStartCompany
        if (!company || !this.trading) return []
        const homes: StartHome[] = []
        for (const marketSpaceId of this.session.rules.companyRules.startMarketSpaces(
            this.session.state,
            company.companyId
        ))
            for (const home of this.startHomes(company.companyId, marketSpaceId) ?? [])
                if (!homes.some((entry) => sameCenter(entry, home))) homes.push(home)
        return homes
    })
    /** The cities offered on the map for the chosen company's home, until one is chosen. */
    homePositions = $derived.by(() => (this.selectedStartHome ? [] : this.offeredStartHomes))
    /** Whether the chosen company still needs its home before its price. */
    awaitingStartHome = $derived.by(() => this.homePositions.length > 0)
    chosenHome = $derived.by((): StationReservation | undefined =>
        this.selectedStartCompany && this.selectedStartHome
            ? stationReservation(this.selectedStartCompany.companyId, this.selectedStartHome)
            : undefined
    )
    /** The chosen home and what it costs its company. */
    selectedStartHomeChoice = $derived.by(() => {
        const home = this.selectedStartHome
        return home ? this.offeredStartHomes.find((entry) => sameCenter(entry, home)) : undefined
    })
    /** The most ordinary certificates the chosen company's start may add to the president's. */
    maxExtraStartCertificates = $derived.by(() => {
        const company = this.selectedStartCompany
        if (!company) return 0
        const { state, rules } = this.session
        return Math.min(
            rules.companyRules.additionalStartCertificates?.(state, company.companyId) ?? 0,
            this.startCertificateIds(company.companyId).length
        )
    })
    /** Each holding the chosen company's start may buy, as a percentage of the company. */
    startSizes = $derived.by((): { extra: number; percent: number }[] => {
        const company = this.selectedStartCompany
        if (!company) return []
        const { state, rules } = this.session
        const president = state.certificates.find(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.president &&
                certificate.companyId === company.companyId
        )
        const shareCount = companyShareCount(state, rules.stockRules.charters, company.companyId)
        if (!president || president.kind !== 'share' || !shareCount) return []
        return Array.from({ length: this.maxExtraStartCertificates + 1 }, (_, extra) => ({
            extra,
            percent: Math.round(((president.shares + extra) * 100) / shareCount)
        }))
    })
    /** What a start costs its president in all: the president's certificate and any further ones. */
    startCost(details: CompanyStartDetails): number {
        return (details.additionalPurchases ?? []).reduce(
            (total, purchase) => total + purchase.price,
            details.price
        )
    }
    /** The ordinary certificates chosen to buy with the president's. */
    selectedExtraStartCertificates = $derived.by(() => this.start.value('extraCertificates') ?? 0)
    /** The company's single-share certificates still with the bank or its treasury. */
    private startCertificateIds(companyId: string): string[] {
        return this.session.state.certificates
            .filter(
                (certificate) =>
                    certificate.kind === 'share' &&
                    !certificate.president &&
                    certificate.shares === 1 &&
                    certificate.companyId === companyId &&
                    certificate.owner.kind !== 'player'
            )
            .map((certificate) => certificate.id)
    }
    private extraStartCertificateIds(companyId: string): string[] {
        return this.startCertificateIds(companyId).slice(0, this.selectedExtraStartCertificates)
    }
    /** The chosen company's start at a price, with its home and further certificates as chosen. */
    private startRequest(marketSpaceId: string): CompanyStartRequest | undefined {
        const company = this.selectedStartCompany
        if (!company) return undefined
        const home = this.selectedStartHome
        const additionalCertificateIds = this.extraStartCertificateIds(company.companyId)
        return {
            ...company,
            marketSpaceId,
            ...(home ? { home } : {}),
            ...(additionalCertificateIds.length ? { additionalCertificateIds } : {})
        }
    }
    private selectedStartRequest = $derived.by((): CompanyStartRequest | undefined => {
        const marketSpaceId = this.start.value('marketSpaceId')
        return marketSpaceId ? this.startRequest(marketSpaceId) : undefined
    })
    selectedStartPrices = $derived.by(() => {
        const company = this.selectedStartCompany
        const prices =
            this.startChoices.find(
                (choice) =>
                    company &&
                    choice.request.companyId === company.companyId &&
                    sameOwner(choice.request.buyer, company.buyer)
            )?.prices ?? []
        if (!company || !this.extraStartCertificateIds(company.companyId).length) return prices
        return prices.flatMap(({ marketSpaceId }) => {
            const request = this.startRequest(marketSpaceId)
            return request
                ? [
                      {
                          marketSpaceId,
                          result: evaluateCompanyStart(
                              this.session.state,
                              request,
                              this.session.rules.stockRules,
                              this.session.rules.companyRules
                          )
                      }
                  ]
                : []
        })
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

    canPar = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('ParCompany')
    )
    parSpaceIds = $derived.by(() =>
        this.session.state.pendingPar
            ? awardParSpaces(
                  this.session.state,
                  this.session.rules.companyRules,
                  this.session.state.pendingPar.companyId
              )
            : []
    )
    async parCompany(marketSpaceId: string) {
        const pending = this.session.state.pendingPar
        assert(this.canPar && pending, 'No par is awaiting this player')
        await this.session.applyAction(
            this.session.createPlayerAction(ParCompany, {
                companyId: pending.companyId,
                marketSpaceId
            })
        )
    }

    purchaseChoices = $derived.by(() => {
        const { state, rules, playerId } = this.session
        if (!playerId || !this.trading) return []
        const choices = rules.stockRules.buyers(state, playerId).flatMap((buyer) =>
            state.certificates
                .filter(
                    (certificate) =>
                        certificate.kind === 'share' &&
                        (certificate.poolId !== undefined ||
                            (certificate.owner.kind === 'company' &&
                                certificate.owner.companyId === certificate.companyId))
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
        return state.stockRound.turn.bought
            ? choices.filter((choice) => choice.result.details)
            : choices
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
                    return {
                        sale,
                        request,
                        result: evaluateShareSale(state, request, rules.stockRules)
                    }
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
            (choice) => choice.sale.companyId === this.selectedSaleCompany && choice.result.details
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
    chooseHome(home: HomePosition) {
        this.assertAvailable(this.session.playerId)
        assert(
            this.homePositions.some((position) => sameCenter(position, home)),
            'Choose an offered home city'
        )
        this.start.choose('home', { locationId: home.locationId, nodeId: home.nodeId })
    }
    chooseExtraStartCertificates(count: number) {
        this.assertAvailable(this.session.playerId)
        assert(this.start.value('company'), 'Choose a company before its certificates')
        assert(
            count >= 0 && count <= this.maxExtraStartCertificates,
            'The start cannot include this many certificates'
        )
        this.start.choose('extraCertificates', count)
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
        if (sales.length)
            this.trade.choose('choice', { kind: 'sale', request: { ...trade.request, sales } })
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
                expectedPrice: details.price,
                ...(details.home
                    ? {
                          home: {
                              locationId: details.home.position.locationId,
                              nodeId: details.home.position.nodeId
                          }
                      }
                    : {}),
                ...(details.additionalPurchases?.length
                    ? {
                          additionalCertificateIds: details.additionalPurchases.map(
                              (purchase) => purchase.certificateId
                          )
                      }
                    : {})
            })
        )
    }
    /** One purchase per buyer of each distinct certificate offer and price. */
    availablePurchases = $derived.by(() => {
        const purchases: AvailablePurchase[] = []
        for (const { certificate, request, result } of this.purchaseChoices) {
            if (certificate.kind !== 'share' || !result.details) continue
            const details = result.details
            if (
                !purchases.some(
                    (purchase) =>
                        sameOwner(purchase.request.buyer, request.buyer) &&
                        sameCertificateOffer(purchase.certificate, certificate) &&
                        purchase.details.price === details.price
                )
            )
                purchases.push({ certificate, request, details })
        }
        return purchases
    })
    companyTrades(companyId: string): CompanyTrades {
        if (!this.session.interactive) return { buyers: [], offers: [], sales: [] }
        const offers = this.companyShareOffers(companyId)
        return {
            buyers: distinctOwners(
                offers.flatMap((offer) => offer.purchases.map((purchase) => purchase.request.buyer))
            ),
            offers,
            sales: this.companyShareSales(companyId)
        }
    }
    private companyShareOffers(companyId: string): CompanyShareOffer[] {
        const offers: CompanyShareOffer[] = []
        for (const purchase of this.availablePurchases) {
            if (purchase.certificate.companyId !== companyId) continue
            const offer = offers.find((candidate) =>
                sameCertificateOffer(candidate.certificate, purchase.certificate)
            )
            if (!offer) offers.push({ certificate: purchase.certificate, purchases: [purchase] })
            else if (
                !offer.purchases.some((offered) =>
                    sameOwner(offered.request.buyer, purchase.request.buyer)
                )
            )
                offer.purchases.push(purchase)
        }
        return offers
    }
    private companyShareSales(companyId: string): CompanyShareSales[] {
        const groups: CompanyShareSales[] = []
        for (const { sale, request, result } of this.saleChoices) {
            if (sale.companyId !== companyId || !result.details) continue
            const entry = { request, shares: sale.shares, proceeds: result.details.proceeds }
            const group = groups.find((candidate) => sameOwner(candidate.seller, request.seller))
            if (group) group.sales.push(entry)
            else groups.push({ seller: request.seller, sales: [entry] })
        }
        return groups
    }
    /** Buys at once, leaving the stock menu as it is. */
    async buy(request: PurchaseRequest) {
        this.assertAvailable(request.playerId)
        const details = evaluateSharePurchase(
            this.session.state,
            request,
            this.session.rules.stockRules
        ).details
        assertExists(details, 'Purchase is unavailable')
        await this.session.applyAction(this.purchaseAction(details))
    }
    /** Sells at once, leaving the stock menu as it is. */
    async sell(request: SaleRequest) {
        this.assertAvailable(request.playerId)
        const details = evaluateShareSale(
            this.session.state,
            request,
            this.session.rules.stockRules
        ).details
        assertExists(details, 'Sale is unavailable')
        await this.session.applyAction(this.saleAction(details))
    }
    async buyAndReopenMenu(request: PurchaseRequest) {
        this.selectPurchase(request)
        await this.confirmPurchase()
    }
    async sellAndReopenMenu(request: SaleRequest) {
        this.selectSale(request)
        await this.confirmSale()
    }
    async confirmPurchase() {
        this.assertAvailable(this.session.playerId)
        const details = this.selectedPurchaseDetails
        assertExists(details, 'Select an available purchase')
        await this.applyAndContinue(this.purchaseAction(details), () =>
            this.purchaseChoices.some(
                (choice) => choice.result.details && sameOwner(choice.request.buyer, details.buyer)
            )
                ? { menu: 'buy', buyer: details.buyer }
                : undefined
        )
    }
    private purchaseAction(details: SharePurchaseDetails) {
        return this.session.createPlayerAction(BuyShares, {
            buyer: details.buyer,
            certificateId: details.certificateId,
            expectedPrice: details.price
        })
    }
    furtherPurchaseCompanyId = $derived.by(() => {
        const { state, playerId } = this.session
        const buyer: Owner | undefined =
            this.menuBuyer ?? (playerId ? { kind: 'player', playerId } : undefined)
        if (!state.stockRound.turn.bought || !buyer) return undefined
        return this.purchaseChoices.find(
            (choice) => choice.result.details && sameOwner(choice.request.buyer, buyer)
        )?.certificate.companyId
    })
    async confirmSale() {
        this.assertAvailable(this.session.playerId)
        const details = this.selectedSaleResult?.details
        assertExists(details, 'Select an available sale')
        await this.applyAndContinue(this.saleAction(details), () =>
            this.saleChoices.some((choice) => choice.result.details) ? { menu: 'sell' } : undefined
        )
    }
    private saleAction(details: ShareSaleDetails) {
        const sales: ShareSale[] = details.sales.map(({ companyId, shares }) => ({
            companyId,
            shares
        }))
        return this.session.createPlayerAction(SellShares, {
            seller: details.seller,
            sales,
            expectedProceeds: details.proceeds
        })
    }
    private async applyAndContinue(
        action: GameAction,
        nextMenu: () => { menu: StockAction; buyer?: Owner } | undefined
    ) {
        const playerId = this.session.playerId
        const roundNumber = this.session.state.stockRound.number
        await this.session.applyAction(action)
        await this.session.settled()
        if (
            !playerId ||
            this.session.playerId !== playerId ||
            !this.session.state.activePlayerIds.includes(playerId) ||
            this.session.viewingHistory ||
            this.session.state.stockRound.number !== roundNumber
        )
            return
        const next = nextMenu()
        if (!next) return
        this.menu.clear()
        this.menu.choose('action', next, 'auto')
    }
    sellsPrivates = $derived.by(() => !!this.session.rules.stockRules.privateSales)
    privateChoices = $derived.by(() => {
        const { state, rules, playerId } = this.session
        if (!playerId || !this.trading) return []
        return privateSaleChoices(state, rules.stockRules, playerId).map((choice) => ({
            ...choice,
            suggestedPrice: suggestedPrivateSalePrice(state, choice, rules.endingRules)
        }))
    })
    privateOfferReason(privateCompanyId: string, price: number): string | undefined {
        const playerId = this.session.playerId
        if (!playerId) return 'Only a player may offer for a private.'
        return privateSaleOfferReason(this.session.state, this.session.rules.stockRules, {
            playerId,
            privateCompanyId,
            price
        })
    }
    async offerPrivatePurchase(privateCompanyId: string, price: number) {
        const playerId = this.session.playerId
        assert(
            playerId && !this.privateOfferReason(privateCompanyId, price),
            'Choose a private and a price this player may offer'
        )
        await this.session.applyAction(
            this.session.createPlayerAction(OfferPrivatePurchase, { privateCompanyId, price })
        )
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
