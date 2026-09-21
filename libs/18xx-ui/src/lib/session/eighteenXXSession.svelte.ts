import { PrivatesModule } from './privatesModule.svelte.js'
import { OfferAuctionModule } from './offerAuctionModule.svelte.js'
import { WaterfallAuctionModule } from './waterfallAuctionModule.svelte.js'
import type { SessionContext } from './sessionContext.js'
import { EarningsModule } from './earningsModule.svelte.js'
import { DiscardModule } from './discardModule.svelte.js'
import { SessionDrafts, clearableDraft } from './sessionDrafts.js'
import { shouldContinueHistoryStep } from '../table/historyNavigation.js'
import { operatingStepIndex } from '../table/operatingStep.js'
import { operatingHistory } from '../table/operatingHistory.js'
import { createMarketAnimationSource } from '../stock/marketAnimationSource.js'
import { setStagedSelectionValue, type StagedSelectionState } from '@tabletop/frontend-components'
import { isSellFundingShares, isIssueTreasuryShares, isContributeTrainFunds } from '@tabletop/18xx'
import { EighteenXXPreferenceDefinition, type EighteenXXPreferences } from '@tabletop/18xx'
import { isOfferPurchase, isRespondToPurchaseOffer, isDistributeEarnings } from '@tabletop/18xx'
import type { TitlePreferences } from '@tabletop/frontend-components'
import { chooseTrainSource, chooseCompanyTrain, backFromTrainBuying, type TrainBuyingSelection, type TrainSource } from './trainBuyingSelection.js'
import { EighteenXXStateValidator } from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import { HistoricalMaps, type HistoricalMap } from '../maps/historicalMap.js'
import {
    chooseStockAction,
    chooseSaleCompany,
    backFromStockAction,
    type StockAction,
    type StockActionSelection
} from '../stock/stockActionSelection.js'
import { cashOwnedBy, shareSaleValue, priorityOrder, stockCertificateCount, stockMarketOrder } from '@tabletop/18xx'
import {
    type HydratedEighteenXXState,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import type { OfferAuctionSelection } from '../auctions/auctionSelection.js'
import type { AuctionSelection } from '../auctions/auctionSelection.js'
import {
    BuyAuctionLot
} from '@tabletop/18xx'
import {
    EmergencyTrainFunding,
    FundTrain,
    IssueTreasuryShares,
    SellFundingShares,
    ContributeTrainFunds,
    type ShareSaleDetails
} from '@tabletop/18xx'
import {
    isLayPrivateTile,
    isRespondToTrackConsent,
    ContinueOperatingRound,
    purchaseChoices,
    evaluatePurchaseOffer,
    OfferPurchase,
    RespondToPurchaseOffer,
    RequestTrackConsent,
    RespondToTrackConsent,
    LayPrivateTile,
    DeclinePrivateTile,
    BuyPrivateTrain,
    privateTrackConstruction,
    privateTrainPurchase,
    pendingCompanyDecision,
    evaluatePrivateTrack,
    type PurchaseOfferRequest,
    type TrackLayDetails,
    type TrainPurchaseDetails
} from '@tabletop/18xx'
type PrivateTrackPower = { privateCompanyId: string; playerId: string }
type CompanyDecisionDraft =
    | { kind: 'purchase'; request: PurchaseOfferRequest }
    | { kind: 'tile'; privateCompanyId: string; playerId: string; details: TrackLayDetails }
    | { kind: 'train'; privateCompanyId: string; details: TrainPurchaseDetails }
import {
    evaluatePrivateExchange
} from '@tabletop/18xx'
import { GameStorage } from '@tabletop/common'
import { discardableTrains } from '@tabletop/18xx'
import {
    FinishOperatingTurn,
    finishOperatingTurnReason
} from '@tabletop/18xx'
import { routeColor } from '../routes/routePresentation.js'
import { RouteEditor } from './routeEditor.svelte.js'
import {
    RunTrains,
    RouteEvaluation,
    type OperatingResult,
    type RevenueCenter,
    type RoutePath
} from '@tabletop/18xx'
import {
    BuyTrain,
    TrainPurchase,
    isBuyTrain,
    trainsOwnedBy,
    type TrainPurchaseRequest
} from '@tabletop/18xx'
import {
    StationPlacement,
    PlaceStation,
    FinishStations,
    isPlaceStation,
    TrackNetwork,
    RailwayMapState,
    applyStationPlacement,
    type StationRequest
} from '@tabletop/18xx'
import {
    chooseStation,
    chooseStationPosition,
    backFromStation,
    type StationSelection
} from './stationSelection.js'
import {
    TrackConstruction,
    LayTile,
    FinishTrack,
    isLayTile,
    type TrackRequest
} from '@tabletop/18xx'
import {
    chooseTrackLocation,
    chooseTrackTile,
    chooseTrackPlacement,
    backFromTrack,
    type TrackSelection
} from './trackSelection.js'
import { createMapDrawing, isMapSelectionValid, type MapSelection } from '../maps/mapDrawing.js'
import { stationMapTokens, type MapViewDefinition, type StationAppearance } from '../maps/stationPresentation.js'
import {
    chooseStartCompany,
    chooseStartPrice,
    backFromCompanyStart,
    companyStartRequest,
    type CompanyStartSelection
} from './companyStartSelection.js'
import { GameSession } from '@tabletop/frontend-components'
import { assert, assertExists, type GameState, type HydratedGameState } from '@tabletop/common'
import {
    StartCompany,
    isStartCompany,
    isFloatCompany,
    isFinishStockTurn,
    isCompleteStockRound,
    isStartOperatingSet,
    evaluateCompanyStart,
    flotationAfterPurchase,
    type TileFace,
    type CompanyStartRequest,
    BuyShares,
    SellShares,
    FinishStockTurn,
    isBuyShares,
    isSellShares,
    evaluateSharePurchase,
    evaluateShareSale,
    requireEighteenXXState,
    type EighteenXXState,
    getCompany,
    sharesOwned,
    sameOwner,
    exceedsStockLimits,
    type PurchaseRequest,
    type SaleRequest,
    type ShareSale,
    type Owner,
    type Portfolio
} from '@tabletop/18xx'

type SessionOptions = ConstructorParameters<typeof GameSession<GameState, HydratedGameState>>[0]
type Selection =
    | { kind: 'purchase'; request: PurchaseRequest }
    | { kind: 'sale'; request: SaleRequest }
    | { kind: 'start'; stages: CompanyStartSelection }
export class EighteenXXSession extends GameSession<GameState, HydratedGameState> {
    privateCardPhaseColors: Readonly<Record<string, string>> = $derived({})
    privateCompanyTokens: Readonly<Record<string, StationAppearance>> = $derived({})
    operatingIncomeHistory() {
        return operatingHistory(this.history.visibleContext.actions)
    }
    readonly marketAnimation = createMarketAnimationSource(this, (state) => requireEighteenXXState(state).stockMarket)
    readonly preferences: TitlePreferences<typeof EighteenXXPreferences> = this.createPreferences(EighteenXXPreferenceDefinition)
    selection: Selection | undefined = $state()
    protected readonly drafts = new SessionDrafts()
    private get localHotseat() {
        return !!this.game.hotseat && this.game.storage === GameStorage.Local
    }
    private readonly context: SessionContext<HydratedEighteenXXState, EighteenXXTitleRules> = ((
        session: EighteenXXSession
    ) => ({
        get state() { return session.financialState },
        get rules() { return session.rules },
        get validActionTypes() { return session.validActionTypes },
        get draftsVisible() { return !session.updatingVisibleState && !session.isViewingHistory },
        get interactive() { return !session.busy && !session.updatingVisibleState && !session.isViewingHistory },
        get actingPlayerIds() {
            return session.localHotseat ? session.financialState.activePlayerIds
                : session.myPlayer ? [session.myPlayer.id] : []
        },
        canActFor: (playerId) => session.localHotseat || session.myPlayer?.id === playerId,
        createPlayerAction: (schema, data) => session.createPlayerAction(schema, data),
        applyAction: (action) => session.applyAction(action)
    }))(this)
    readonly offers = new OfferAuctionModule(this.context)
    readonly waterfall = new WaterfallAuctionModule(this.context)
    readonly privates = new PrivatesModule(this.context)
    readonly earnings = new EarningsModule(this.context)
    readonly discard = new DiscardModule(this.context)
    constructor(
        options: SessionOptions,
        private readonly rules: EighteenXXTitleRules,
        readonly mapView: MapViewDefinition
    ) {
        super(options)
        this.historicalMaps = new HistoricalMaps(mapView)
        this.registerDrafts()
    }
    auctionLotsFor(state: EighteenXXState) {
        return this.rules.offerAuctionRules?.lots(state) ?? this.rules.auctionRules?.lots(state) ?? []
    }
    protected override getActivePlayers() {
        return this.gameState.activePlayerIds.flatMap((id) =>
            this.game.players.filter((player) => player.id === id)
        )
    }
    private privateActionStages: StagedSelectionState<{ source: 'mine' | 'other' | 'powers'; power: PrivateTrackPower }> = $state({})
    privateActionSelection = $derived(!this.updatingVisibleState && !this.isViewingHistory ? this.privateActionStages.source?.value : undefined)
    privatePurchaseSource = $derived(this.privateActionSelection === 'powers' ? undefined : this.privateActionSelection)
    get privatePowersAvailable() { return this.privateTileOptions.length > 0 || this.privateTrainOptions.length > 0 }
    choosePrivatePowers() {
        this.trackDraft = {}
        this.companyDraft = undefined
        this.privateActionStages = setStagedSelectionValue(this.privateActionStages, ['source', 'power'], 'source', 'powers', 'manual')
    }
    get privatePurchaseHeading(): string | undefined { return 'Available privates' }
    privatePurchases = $derived.by(() => this.purchaseOptions.filter((option) => option.request.asset.kind === 'private'))
    choosePrivatePurchaseSource(source: 'mine' | 'other') {
        this.trackDraft = {}
        this.companyDraft = undefined
        this.privateActionStages = setStagedSelectionValue(this.privateActionStages, ['source', 'power'], 'source', source, 'manual')
    }
    private companyDraft: CompanyDecisionDraft | undefined = $state()
    companyDecisionSelection = $derived(
        !this.updatingVisibleState && !this.isViewingHistory ? this.companyDraft : undefined
    )
    canResolveCompanyDecision = $derived(
        !this.busy && !this.updatingVisibleState && !this.isViewingHistory
    )
    purchaseOptions = $derived.by(() =>
        this.canResolveCompanyDecision &&
        this.myPlayer &&
        this.validActionTypes.includes('OfferPurchase')
            ? purchaseChoices(
                  this.financialState,
                  this.myPlayer.id,
                  this.rules.transferRules,
                  this.rules.trainRules
              )
            : []
    )
    companyDecisionPlayers = $derived.by(() =>
        !this.canResolveCompanyDecision
            ? []
            : this.context.actingPlayerIds
    )
    privateTileOptions = $derived.by(() => {
        const state = this.financialState
        if (state.purchaseOffer || state.trackConsent) return []
        return this.companyDecisionPlayers.flatMap((playerId) =>
            state.companies
                .filter(
                    (company) =>
                        company.kind === 'private' &&
                        !company.closed &&
                        !state.usedPrivatePowerIds.includes(company.id)
                )
                .flatMap((company) => {
                    const terms = this.rules.privatePowerRules.trackTerms(state, company.id, playerId)
                    if (!terms) return []
                    const construction = privateTrackConstruction(state, terms, this.rules.trackRules)
                    return terms.locationIds.flatMap((locationId) =>
                        construction
                            .choices(locationId)
                            .map((details) => ({ privateCompanyId: company.id, playerId, details }))
                    )
                })
        )
    })
    privateTrackPowers = $derived.by(() => {
        const powers: PrivateTrackPower[] = []
        for (const { privateCompanyId, playerId } of this.privateTileOptions) {
            if (!powers.some((power) => power.privateCompanyId === privateCompanyId && power.playerId === playerId))
                powers.push({ privateCompanyId, playerId })
        }
        return powers
    })
    privateTrackPowerSelection = $derived.by(() => {
        if (this.updatingVisibleState || this.isViewingHistory ||
            (this.privateActionSelection !== 'powers' && !this.financialState.privateTrackLay && !this.financialState.privatePowerWindow)) return undefined
        const selected = this.privateActionStages.power
        if (selected && this.privateTrackPowers.some((power) => power.privateCompanyId === selected.value.privateCompanyId && power.playerId === selected.value.playerId)) return selected
        return this.privateTrackPowers.length === 1
            ? { value: this.privateTrackPowers[0], source: 'auto' as const } : undefined
    })
    choosePrivateTrackPower(power: PrivateTrackPower) {
        assert(this.privateTrackPowers.some((option) => option.privateCompanyId === power.privateCompanyId && option.playerId === power.playerId), 'Choose an available private tile power')
        this.trackDraft = {}
        this.privateActionStages = setStagedSelectionValue(this.privateActionStages, ['source', 'power'], 'power', power, 'manual')
    }
    privateTrainOptions = $derived.by(() => {
        if (
            !this.canResolveCompanyDecision ||
            !this.myPlayer ||
            pendingCompanyDecision(this.financialState)
        )
            return []
        return this.financialState.companies.flatMap((company) => {
            const companyId = this.rules.privatePowerRules.earlyTrainCompany(
                this.financialState,
                company.id,
                this.myPlayer!.id
            )
            return companyId
                ? privateTrainPurchase(this.financialState, companyId, this.rules.trainRules)
                      .offers()
                      .flatMap((offer) =>
                          offer.evaluation.details
                              ? [
                                    {
                                        privateCompanyId: company.id,
                                        details: offer.evaluation.details
                                    }
                                ]
                              : []
                      )
                : []
        })
    })
    purchaseOfferEvaluation = $derived.by(() =>
        this.companyDecisionSelection?.kind === 'purchase'
            ? evaluatePurchaseOffer(
                  this.financialState,
                  this.companyDecisionSelection.request,
                  this.rules.transferRules,
                  this.rules.trainRules
              )
            : undefined
    )
    selectPurchaseOffer(request: PurchaseOfferRequest) {
        assert(
            this.canResolveCompanyDecision && this.validActionTypes.includes('OfferPurchase'),
            'Purchasing is unavailable'
        )
        let price = request.price
        if (request.asset.kind === 'private') {
            const range = this.rules.transferRules.priceRange(this.financialState, request.companyId, request.asset)
            assertExists(range, 'Private purchase requires a price range')
            const cash = cashOwnedBy(this.financialState, { kind: 'company', companyId: request.companyId })
            assert(typeof cash === 'number', 'Purchasing company requires a cash balance')
            price = Math.min(cash, range.maximum ?? cash)
        }
        this.companyDraft = { kind: 'purchase', request: { ...request, price } }
    }
    setPurchasePrice(price: number) {
        assert(this.companyDraft?.kind === 'purchase', 'Select an asset first')
        this.companyDraft.request.price = price
    }
    selectPrivateTile(option: {
        privateCompanyId: string
        playerId: string
        details: TrackLayDetails
    }) {
        assert(
            this.companyDecisionPlayers.includes(option.playerId) &&
                evaluatePrivateTrack(
                    this.financialState,
                    option.privateCompanyId,
                    option.playerId,
                    option.details,
                    this.rules.privatePowerRules,
                    this.rules.trackRules
                ).details,
            'Choose an available private tile lay'
        )
        this.companyDraft = { kind: 'tile', ...option }
    }
    selectPrivateTrain(option: Omit<Extract<CompanyDecisionDraft, { kind: 'train' }>, 'kind'>) {
        assert(
            this.privateTrainOptions.some(
                (item) =>
                    item.privateCompanyId === option.privateCompanyId &&
                    item.details.trainId === option.details.trainId
            ),
            'Choose an available private train purchase'
        )
        this.companyDraft = { kind: 'train', ...option }
    }
    backCompanyDecision() {
        this.companyDraft = undefined
    }
    async buyPrivateTrain(option: Omit<Extract<CompanyDecisionDraft, { kind: 'train' }>, 'kind'>) {
        this.selectPrivateTrain(option)
        await this.confirmCompanyDecision()
    }
    async confirmCompanyDecision() {
        const draft = this.companyDecisionSelection
        assert(this.canResolveCompanyDecision && draft, 'Choose a company decision')
        if (draft.kind === 'purchase') {
            assert(
                this.purchaseOfferEvaluation && !this.purchaseOfferEvaluation.reason,
                'This offer is unavailable'
            )
            await this.applyAction(this.createPlayerAction(OfferPurchase, draft.request))
        } else if (draft.kind === 'tile') {
            const { companyId, locationId, definitionId, rotation, nodeMapping, cost } =
                draft.details
            assert(
                this.companyDecisionPlayers.includes(draft.playerId),
                'Only the entitled player may lay this tile'
            )
            const action = this.createPlayerAction(LayPrivateTile, {
                privateCompanyId: draft.privateCompanyId,
                companyId,
                locationId,
                definitionId,
                rotation,
                nodeMapping,
                expectedCost: cost
            })
            action.playerId = draft.playerId
            await this.applyAction(action)
        } else {
            const { companyId, trainId, definitionId, price } = draft.details
            await this.applyAction(
                this.createPlayerAction(BuyPrivateTrain, {
                    privateCompanyId: draft.privateCompanyId,
                    companyId,
                    trainId,
                    definitionId,
                    expectedPrice: price
                })
            )
        }
    }
    async respondToPurchaseOffer(accept: boolean) {
        assert(
            this.canResolveCompanyDecision &&
                this.validActionTypes.includes('RespondToPurchaseOffer') &&
                this.financialState.purchaseOffer,
            'No offer is awaiting this player'
        )
        await this.applyAction(
            this.createPlayerAction(RespondToPurchaseOffer, {
                offerId: this.financialState.purchaseOffer.id,
                accept
            })
        )
    }
    async respondToTrackConsent(accept: boolean) {
        assert(
            this.canResolveCompanyDecision &&
                this.validActionTypes.includes('RespondToTrackConsent') &&
                this.financialState.trackConsent,
            'No permission request is awaiting this player'
        )
        await this.applyAction(
            this.createPlayerAction(RespondToTrackConsent, {
                requestId: this.financialState.trackConsent.id,
                accept
            })
        )
    }
    async continueOperatingRound() {
        assert(
            this.canResolveCompanyDecision &&
                this.validActionTypes.includes('ContinueOperatingRound') &&
                this.financialState.privatePowerWindow,
            'No private power window awaits this player'
        )
        await this.applyAction(
            this.createPlayerAction(ContinueOperatingRound, {
                companyId: this.financialState.privatePowerWindow.companyId
            })
        )
    }
    async declinePrivateTile() {
        assert(
            this.canResolveCompanyDecision &&
                this.validActionTypes.includes('DeclinePrivateTile') &&
                this.financialState.privateTrackLay,
            'No private tile lay is awaiting this player'
        )
        await this.applyAction(
            this.createPlayerAction(DeclinePrivateTile, {
                privateCompanyId: this.financialState.privateTrackLay.privateCompanyId
            })
        )
    }
    privatePurchasePriceRange(companyId: string, privateCompanyId: string) {
        return this.rules.transferRules.priceRange(this.financialState, companyId, {
            kind: 'private',
            privateCompanyId
        })
    }
    finishOperatingReason = $derived.by(() => {
        const companyId = this.financialState.trainPurchaseStep?.companyId
        return companyId
            ? finishOperatingTurnReason(this.financialState, this.rules.trainRules, companyId)
            : undefined
    })
    canFinishOperatingTurn = $derived.by(
        () =>
            !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            !this.trainSelection &&
            this.validActionTypes.includes('FinishOperatingTurn')
    )
    async finishOperatingTurn() {
        const companyId = this.financialState.trainPurchaseStep?.companyId
        assert(this.canFinishOperatingTurn && companyId, 'The operating turn cannot finish yet')
        await this.applyAction(this.createPlayerAction(FinishOperatingTurn, { companyId }))
    }
    private automaticRoutes:
        | { state: EighteenXXState; result: OperatingResult; exhaustive: boolean }
        | undefined = $state.raw()
    automaticRouteResult = $derived.by(() => {
        if (!this.routeDraftVisible) return undefined
        const state = this.financialState
        const companyId = state.routeStep?.companyId
        if (companyId && !trainsOwnedBy(state, { kind: 'company', companyId }).length) {
            const checked = new RouteEvaluation(state, this.rules.routeRules).evaluate(companyId, [])
            assertExists(checked.result, checked.reason ?? 'Invalid empty train run')
            return { state, result: checked.result, exhaustive: true }
        }
        return this.automaticRoutes?.state === state ? this.automaticRoutes : undefined
    })
    setAutomaticRoutes(state: EighteenXXState, result: OperatingResult, exhaustive: boolean) {
        if (state !== this.financialState || !this.canRunTrains) return
        const companyId = state.routeStep?.companyId
        assert(
            companyId && result.companyId === companyId,
            'Automatic routes require the operating company'
        )
        const routes = this.trainRoutes(result)
        const checked = new RouteEvaluation(state, this.rules.routeRules).evaluate(companyId, routes)
        assertExists(checked.result, checked.reason ?? 'Invalid automatic routes')
        this.automaticRoutes = { state, result: checked.result, exhaustive }
    }
    async runAutomaticTrains() {
        const result = this.automaticRouteResult?.result
        assert(this.canRunTrains && result, 'Wait for the train routes to be calculated')
        await this.applyAction(
            this.createPlayerAction(RunTrains, {
                companyId: result.companyId,
                routes: this.trainRoutes(result)
            })
        )
    }
    private trainRoutes(result: OperatingResult) {
        return result.routes.map(({ trainId, start, paths }) => ({ trainId, start, paths }))
    }
    routeEditor = $derived.by(() => new RouteEditor(this.financialState, this.rules.routeRules))
    canRunTrains = $derived(
        !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.validActionTypes.includes('RunTrains')
    )
    routeDraftVisible = $derived.by(
        () =>
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.financialState.machineState === 'RunningTrains'
    )
    routeOverlays = $derived.by(() => {
        if (this.updatingVisibleState) return []
        const result = this.financialState.routeStep?.result
        const routes = this.routeDraftVisible
            ? (this.automaticRouteResult?.result.routes ?? this.routeEditor.routes)
            : (result?.routes ?? [])
        const overlays = routes.map((route, index) => ({
            id: route.trainId,
            color: routeColor(index),
            segments: route.paths
        }))
        if (this.routeDraftVisible && this.routeEditor.route)
            overlays.push({ id: 'route-draft', color: '#d58400', segments: this.routeEditor.paths })
        return overlays
    })
    displayedRoutes = $derived.by(() =>
        this.automaticRouteResult ||
        this.financialState.routeStep?.result ||
        this.routeOverlays.length
            ? this.routeOverlays
            : this.networkRoutes
    )
    selectRouteTrain(trainId: string) {
        assert(this.canRunTrains, 'Routes are not active')
        this.routeEditor.selectTrain(trainId)
    }
    selectRouteStart(start: RevenueCenter) {
        assert(this.canRunTrains, 'Routes are not active')
        this.routeEditor.selectStart(start)
        this.inspectMap({ kind: 'node', ...start })
    }
    appendRoutePath(path: RoutePath) {
        assert(this.canRunTrains, 'Routes are not active')
        this.routeEditor.append(path)
        this.inspectMap({ kind: 'path', ...path })
    }
    saveRoute() {
        assert(this.canRunTrains, 'Routes are not active')
        this.routeEditor.save()
    }
    editRoute(trainId: string) {
        assert(this.canRunTrains, 'Routes are not active')
        this.routeEditor.edit(trainId)
    }
    removeRoute(trainId: string) {
        assert(this.canRunTrains, 'Routes are not active')
        this.routeEditor.remove(trainId)
    }
    backRoute() {
        this.routeEditor.back()
    }
    async confirmRoutes() {
        const editor = this.routeEditor
        assert(
            this.canRunTrains && editor.companyId && !editor.trainId && editor.submission?.result,
            'Finish the route draft before submitting'
        )
        await this.applyAction(
            this.createPlayerAction(RunTrains, {
                companyId: editor.companyId,
                routes: editor.routes
            })
        )
    }
    funding = $derived.by(
        () =>
            new EmergencyTrainFunding(
                this.financialState,
                this.rules.trainFundingRules,
                this.rules.stockRules,
                this.rules.trainRules
            )
    )
    fundingPurchases = $derived.by(() =>
        this.financialState.machineState === 'BuyingTrains' ? this.funding.purchases() : []
    )
    fundingChoice = $derived.by(() =>
        this.financialState.machineState === 'FundingTrain' ? this.funding.next() : undefined
    )
    canFundTrain = $derived(
        !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.validActionTypes.includes('FundTrain')
    )
    canResolveFunding = $derived.by(
        () =>
            !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.financialState.machineState === 'FundingTrain' &&
            this.validActionTypes.length > 0
    )
    fundingPurchase = $derived.by(() => this.financialState.trainFunding?.purchase ?? this.fundingPurchases[0])
    fundingPlan = $derived.by(() => this.fundingPurchase ? this.funding.preview(this.fundingPurchase) : undefined)
    fundingSales = $derived.by(() => this.fundingPlan?.choice.kind === 'sell' ? this.fundingPlan.choice.sales : [])
    private fundingActions = $derived.by(() => {
        const actions = this.actions.slice(0, this.gameState.actionCount)
        const start = actions.findLastIndex((action) => action.type === 'FundTrain')
        return this.financialState.trainFunding && start >= 0 ? actions.slice(start + 1) : []
    })
    fundingContributions = $derived(this.fundingActions.filter(isContributeTrainFunds))
    fundingSaleHistory = $derived(this.fundingActions.flatMap((action) =>
        (isSellFundingShares(action) || isIssueTreasuryShares(action)) && action.metadata
            ? [{ id: action.id, details: action.metadata }] : []))
    async fundTrain(purchase: TrainPurchaseDetails, buy = true) {
        assert(this.canFundTrain, 'Train funding is unavailable')
        await this.applyAction(
            this.createPlayerAction(FundTrain, {
                companyId: purchase.companyId,
                trainId: purchase.trainId,
                definitionId: purchase.definitionId,
                expectedPrice: purchase.price
            })
        )
        await this.completeCashFunding(buy)
    }
    async resolveTrainFunding(sale?: ShareSaleDetails) {
        if (sale) assert((this.canFundTrain || this.canResolveFunding) && this.fundingSales.includes(sale), 'Choose a legal funding sale')
        const purchase = this.fundingPurchase
        assert(purchase, 'Funding requires a train')
        if (!this.financialState.trainFunding) {
            await this.fundTrain(purchase, !sale)
            if (!sale) return
        }
        if (sale) {
            await this.applyFundingChoice(sale)
            await this.completeCashFunding(false)
        } else {
            await this.completeCashFunding(true)
        }
    }
    private async applyFundingChoice(sale?: ShareSaleDetails) {
        assert(this.canResolveFunding && this.fundingChoice, 'Train funding is unavailable')
        const choice = this.fundingChoice
        switch (choice.kind) {
            case 'issue':
                await this.applyAction(
                    this.createPlayerAction(IssueTreasuryShares, {
                        expectedProceeds: choice.details.proceeds
                    })
                )
                break
            case 'contribute':
                await this.applyAction(
                    this.createPlayerAction(ContributeTrainFunds, {
                        owner: choice.owner,
                        amount: choice.amount
                    })
                )
                break
            case 'sell': {
                assert(sale, 'Choose shares to sell')
                await this.applyAction(
                    this.createPlayerAction(SellFundingShares, {
                        seller: sale.seller,
                        companyId: sale.sales[0].companyId,
                        shares: sale.sales[0].shares,
                        expectedProceeds: sale.proceeds
                    })
                )
                break
            }
            case 'buy':
                await this.applyAction(
                    this.createPlayerAction(BuyTrain, {
                        companyId: choice.purchase.companyId,
                        trainId: choice.purchase.trainId,
                        definitionId: choice.purchase.definitionId,
                        expectedPrice: choice.purchase.price
                    })
                )
                break
        }
    }
    private async completeCashFunding(buy: boolean) {
        await this.waitForVisibleTransitionSettled()
        while (this.canResolveFunding && this.fundingChoice &&
            (this.fundingChoice.kind === 'issue' || (buy && ['contribute', 'buy'].includes(this.fundingChoice.kind)) || (!buy && this.fundingChoice.kind === 'contribute' && this.fundingPlan?.requiresSales === true))) {
            const actionCount = this.financialState.actionCount
            await this.applyFundingChoice()
            await this.waitForVisibleTransitionSettled()
            if (this.financialState.actionCount === actionCount) break
        }
    }
    private trainDraft: TrainPurchaseRequest | undefined = $state.raw()
    private trainBuyingDraft: TrainBuyingSelection = $state({})
    trainBuyingSelection = $derived.by(() =>
        !this.updatingVisibleState && !this.isViewingHistory && this.financialState.machineState === 'BuyingTrains'
            ? this.trainBuyingDraft : {})
    trainBuyingSource = $derived(this.trainBuyingSelection.source?.value ?? 'depot')
    companyTrainChoices = $derived.by(() => this.purchaseOptions.flatMap((option) => {
        if (option.request.asset.kind !== 'train' || option.request.seller.kind !== 'company') return []
        const evaluation = evaluatePurchaseOffer(this.financialState, option.request, this.rules.transferRules, this.rules.trainRules)
        const trainId = option.request.asset.trainId
        const train = this.financialState.trainInventory.trains.find((train) => train.id === trainId)
        assertExists(train, 'Train purchase choice requires a train')
        return [{ ...option, definitionId: train.definitionId,
            source: evaluation.buyerPlayerId === evaluation.sellerPlayerId ? 'mine' as const : 'others' as const }]
    }))
    companyTrainEvaluation = $derived.by(() => {
        const request = this.trainBuyingSelection.purchase?.value
        return request ? evaluatePurchaseOffer(this.financialState, request, this.rules.transferRules, this.rules.trainRules) : undefined
    })
    selectTrainSource(source: TrainSource) {
        this.trainBuyingDraft = chooseTrainSource(source)
    }
    selectCompanyTrain(request: PurchaseOfferRequest) {
        assert(this.companyTrainChoices.some((choice) => choice.request.asset.kind === 'train' && request.asset.kind === 'train' && choice.request.asset.trainId === request.asset.trainId && choice.source === this.trainBuyingSource), 'Choose an available company train')
        this.trainBuyingDraft = chooseCompanyTrain(this.trainBuyingDraft, { ...request })
    }
    setCompanyTrainPrice(price: number) {
        const request = this.trainBuyingSelection.purchase?.value
        assert(request, 'Choose a company train first')
        this.trainBuyingDraft = chooseCompanyTrain(this.trainBuyingDraft, { ...request, price })
    }
    async buyCompanyTrain() {
        const request = this.trainBuyingSelection.purchase?.value
        assert(request && this.canResolveCompanyDecision && this.validActionTypes.includes('OfferPurchase') && this.companyTrainEvaluation && !this.companyTrainEvaluation.reason, 'Choose a legal company train purchase')
        await this.applyAction(this.createPlayerAction(OfferPurchase, request))
    }
    trainSelection = $derived.by(() =>
        !this.updatingVisibleState &&
        !this.isViewingHistory &&
        this.financialState.machineState === 'BuyingTrains'
            ? this.trainDraft
            : undefined
    )
    trainPurchase = $derived.by(() => new TrainPurchase(this.financialState, this.rules.trainRules))
    trainOffers = $derived(this.trainPurchase.offers())
    availableTrainDefinitionIds = $derived.by(() => this.rules.trainRules.availableDefinitions(this.financialState))
    marketTrainOffers = $derived(this.trainPurchase.marketOffers())
    trainExchanges = $derived(this.trainPurchase.exchanges())
    trainNextPhase = $derived.by(() =>
        this.trainPreview
            ? this.rules.trainRules.phaseAfterPurchase(
                  this.financialState,
                  this.trainPreview.definitionId
              )
            : undefined
    )
    trainPreview = $derived(
        this.trainSelection ? this.trainPurchase.evaluate(this.trainSelection).details : undefined
    )
    canBuyTrain = $derived.by(
        () =>
            !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.financialState.machineState === 'BuyingTrains' &&
            this.validActionTypes.includes('BuyTrain')
    )
    trainPurchases = $derived(this.actions.slice(0, this.gameState.actionCount).filter(isBuyTrain))
    currentTrainPurchaseIds = $derived.by(() => {
        const step = this.financialState.trainPurchaseStep
        if (!step) return []
        const ids = new Set(step.purchasedTrainIds)
        const actions = this.actions.slice(0, this.gameState.actionCount)
        const start = actions.findLastIndex((action) => isDistributeEarnings(action) && action.companyId === step.companyId)
        for (const action of actions.slice(start + 1)) {
            if (!isOfferPurchase(action) && !isRespondToPurchaseOffer(action)) continue
            const offer = action.metadata?.offer
            if (action.metadata?.accepted && offer?.companyId === step.companyId && offer.asset.kind === 'train') ids.add(offer.asset.trainId)
        }
        return [...ids]
    })
    trainRosters = $derived.by(() =>
        this.financialState.companies
            .map((company) => ({
                company,
                trains: trainsOwnedBy(this.financialState, {
                    kind: 'company',
                    companyId: company.id
                })
            }))
            .filter((entry) => entry.trains.length)
    )
    playerPriorityOrder = $derived.by(() =>
        this.financialState.machineState === 'StockRound'
            ? priorityOrder(this.financialState, this.rules.stockRules.round)
            : this.financialState.turnManager.turnOrder
    )
    companySoldOut(companyId: string): boolean {
        return this.rules.stockRules.round.soldOut(this.financialState, companyId)
    }
    playerLiquidity(playerId: string): number {
        const owner = { kind: 'player', playerId } as const
        const cash = cashOwnedBy(this.financialState, owner)
        assert(typeof cash === 'number', 'Player liquidity requires finite cash')
        return cash + shareSaleValue(this.financialState, owner, this.rules.stockRules)
    }
    companyRequiresTrain(companyId: string): boolean {
        return (
            !getCompany(this.financialState, companyId).closed &&
            this.rules.trainRules.requiresTrain(this.financialState, companyId)
        )
    }
    get trainDepot() {
        return this.rules.trainRules.depot
    }
    trainLimit = $derived.by(() =>
        this.financialState.trainPurchaseStep
            ? this.rules.trainRules.trainLimit(
                  this.financialState,
                  this.financialState.trainPurchaseStep.companyId
              )
            : undefined
    )
    selectTrain(request: TrainPurchaseRequest) {
        assert(
            this.canBuyTrain && this.trainPurchase.evaluate(request).details,
            'Choose a legal train purchase'
        )
        this.trainDraft = request
    }
    backTrain() {
        this.trainDraft = undefined
    }
    async confirmTrainPurchase() {
        const preview = this.trainPreview
        assert(this.canBuyTrain && preview, 'Choose a legal train purchase')
        await this.buyTrain(preview)
    }
    async buyTrain(request: TrainPurchaseRequest) {
        const preview = this.trainPurchase.evaluate(request).details
        assert(this.canBuyTrain && preview, 'Choose a legal train purchase')
        await this.applyAction(
            this.createPlayerAction(BuyTrain, {
                companyId: preview.companyId,
                trainId: preview.trainId,
                definitionId: preview.definitionId,
                expectedPrice: preview.price,
                ...(preview.exchangeTrainId ? { exchangeTrainId: preview.exchangeTrainId } : {})
            })
        )
    }
    get requiresStationTokenChoice(): boolean {
        return false
    }
    private stationDraft: StationSelection = $state({})
    stationSelection = $derived.by(() => {
        if (this.updatingVisibleState || this.isViewingHistory ||
            this.financialState.machineState !== 'PlacingStation') return {}
        if (this.stationDraft.stationId) return this.stationDraft
        if (this.requiresStationTokenChoice || !this.canPlaceStation || !this.validActionTypes.includes('PlaceStation')) return {}
        const station = [...this.availableStations]
            .sort((left, right) => this.stationPlacementCost(left.id) - this.stationPlacementCost(right.id))
            .find((token) => this.stationPlacement.choices(token.id).length > 0)
        return station ? chooseStation(station.id, 'auto') : {}
    })
    stationPlacement = $derived.by(
        () => new StationPlacement(this.financialState, this.rules.stationRules)
    )
    canPlaceStation = $derived(
        !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.validActionTypes.includes('FinishStations')
    )
    availableStations = $derived.by(() =>
        this.financialState.stations.filter(
            (station) =>
                station.companyId === this.financialState.stationStep?.companyId &&
                station.status === 'available'
        )
    )
    stationPlacementCost(stationId: string): number {
        const station = this.financialState.stations.find((entry) => entry.id === stationId)
        assert(station?.status === 'available', 'Station cost requires an available token')
        return this.rules.stationRules
            .pendingHomes(this.financialState)
            .some((home) => home.stationId === stationId)
            ? 0
            : this.rules.stationRules.placementCost(this.financialState, stationId)
    }
    stationChoices = $derived(
        this.canPlaceStation && this.stationSelection.stationId
            ? this.stationPlacement.choices(this.stationSelection.stationId.value)
            : []
    )
    stationLocationIds = $derived([
        ...new Set(this.stationChoices.map((choice) => choice.position.locationId))
    ])
    stationPreview = $derived(
        this.stationSelection.placement
            ? this.stationPlacement.evaluate(this.stationSelection.placement.value).details
            : undefined
    )
    stationDisplayState = $derived.by(() => {
        if (!this.stationPreview) return this.financialState
        const state = {
            ...this.financialState,
            stations: [...this.financialState.stations],
            stationReservations: [...this.financialState.stationReservations]
        }
        applyStationPlacement(state, this.stationPreview)
        return state
    })
    stationActions = $derived(
        this.actions.slice(0, this.gameState.actionCount).filter(isPlaceStation)
    )
    showTrackAccess = $state(true)
    private inspectedCompanyId: string | undefined = $state()
    networkCompanies = $derived.by(() =>
        this.financialState.companies.filter((company) =>
            this.financialState.stations.some(
                (station) => station.companyId === company.id && station.status === 'placed'
            )
        )
    )
    networkCompanyId = $derived.by(
        () =>
            this.inspectedCompanyId ??
            this.financialState.stationStep?.companyId ??
            this.financialState.trackStep?.companyId ??
            this.networkCompanies[0]?.id
    )
    network = $derived.by(() =>
        this.networkCompanyId
            ? new TrackNetwork(
                  new RailwayMapState(
                      this.mapView.map,
                      this.mapView.tileSet,
                      this.financialState.tileInventory
                  ),
                  this.stationDisplayState,
                  this.networkCompanyId
              )
            : undefined
    )
    networkRoutes = $derived.by(() =>
        this.showTrackAccess && !this.updatingVisibleState && !this.trackPreview && this.network
            ? [
                  {
                      id: 'track-access',
                      color: '#168da8',
                      segments: this.mapScene.locations.flatMap((entry) =>
                          entry.face.paths
                              .filter((path) => this.network?.usesPath(entry.location.id, path.id))
                              .map((path) => ({ locationId: entry.location.id, pathId: path.id }))
                      )
                  }
              ]
            : []
    )
    blockedCities = $derived.by(() =>
        this.mapScene.locations.flatMap((entry) =>
            entry.face.nodes
                .filter((node) => this.network?.isBlocked(entry.location.id, node.id))
                .map((node) => ({
                    locationId: entry.location.id,
                    nodeId: node.id,
                    name: entry.location.name
                }))
        )
    )
    inspectCompanyNetwork(companyId: string) {
        assert(
            this.networkCompanies.some((company) => company.id === companyId),
            'Choose a company with a station'
        )
        this.inspectedCompanyId = companyId
    }
    selectStation(stationId: string) {
        assert(
            this.canPlaceStation &&
                this.availableStations.some((station) => station.id === stationId),
            'Choose an available station'
        )
        this.stationDraft = chooseStation(stationId)
    }
    selectStationPosition(request: StationRequest) {
        assert(
            this.canPlaceStation &&
                this.stationSelection.stationId?.value === request.stationId &&
                this.stationPlacement.evaluate(request).details,
            'Choose a legal station position'
        )
        this.stationDraft = chooseStationPosition(this.stationSelection, request)
        this.mapInspection = undefined
    }
    backStation() {
        this.stationDraft = backFromStation(this.stationDraft)
    }
    async confirmStation() {
        const preview = this.stationPreview
        assert(this.canPlaceStation && preview, 'Choose a legal station position')
        await this.applyAction(
            this.createPlayerAction(PlaceStation, {
                companyId: preview.companyId,
                stationId: preview.stationId,
                position: preview.position,
                expectedCost: preview.cost
            })
        )
    }
    async finishStations() {
        const companyId = this.financialState.stationStep?.companyId
        assert(
            companyId && this.canPlaceStation && !this.stationSelection.placement,
            'Finish or cancel the station selection'
        )
        await this.applyAction(this.createPlayerAction(FinishStations, { companyId }))
    }
    constructionActions = $derived.by(() =>
        this.actions.slice(0, this.gameState.actionCount).flatMap((action) => {
            const details =
                isLayTile(action) || isLayPrivateTile(action)
                    ? action.metadata
                    : isRespondToTrackConsent(action) && action.metadata?.accepted
                      ? action.metadata.request.details
                      : undefined
            return details
                ? [
                      {
                          id: action.id,
                          locationId: details.locationId,
                          definitionId: details.definitionId,
                          rotation: details.rotation,
                          cost: details.cost
                      }
                  ]
                : []
        })
    )
    private trackDraft: TrackSelection = $state({})
    trackSelection = $derived.by(() =>
        !this.updatingVisibleState &&
        !this.isViewingHistory &&
        (this.privateTrackPowerSelection || (this.financialState.machineState === 'LayingTrack' && !this.privateActionSelection))
            ? this.trackDraft
            : {}
    )
    construction = $derived.by(() => {
        const power = this.privateTrackPowerSelection?.value
        if (!power) return new TrackConstruction(this.financialState, this.rules.trackRules)
        const terms = this.rules.privatePowerRules.trackTerms(this.financialState, power.privateCompanyId, power.playerId)
        assertExists(terms, 'Selected private tile power requires construction terms')
        return privateTrackConstruction(this.financialState, terms, this.rules.trackRules)
    })
    canBuildTrack = $derived(
        !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            (this.privateTrackPowerSelection
                ? this.validActionTypes.includes('LayPrivateTile')
                : !this.privateActionSelection && this.validActionTypes.includes('FinishTrack'))
    )
    showTrackChoices = $derived.by(
        () => !this.isViewingHistory && (!!this.privateTrackPowerSelection || (this.financialState.machineState === 'LayingTrack' && !this.privateActionSelection))
    )
    trackChoicesByLocation = $derived.by(
        () =>
            new Map(
                this.showTrackChoices
                    ? this.mapView.map.definition.locations.map(
                          (location) =>
                              [location.id, this.construction.choices(location.id)] as const
                      )
                    : []
            )
    )
    reachableTrackLocationIds = $derived.by(() =>
        this.showTrackChoices
            ? this.mapView.map.definition.locations
                .filter((location) => this.construction.canReach(location.id))
                .map((location) => location.id)
            : []
    )
    trackLocationIds = $derived(
        [...this.trackChoicesByLocation].filter(([, choices]) => choices.length).map(([id]) => id)
    )
    trackChoices = $derived(
        this.trackSelection.locationId
            ? (this.trackChoicesByLocation.get(this.trackSelection.locationId.value) ?? [])
            : []
    )
    trackTiles = $derived.by(() =>
        this.mapView.tileSet.definitions.filter((tile) =>
            this.trackChoices.some((choice) => choice.definitionId === tile.id)
        )
    )
    trackPlacements = $derived(
        this.trackChoices.filter(
            (choice) => choice.definitionId === this.trackSelection.definitionId?.value
        )
    )
    trackPreview = $derived(
        this.trackSelection.placement
            ? this.construction.evaluate(this.trackSelection.placement.value).details
            : undefined
    )
    trackTileInFlight = $derived.by(() => {
        this.trackSelection
        return false
    })
    displayedTrackPreview = $derived.by(() => this.financialState.trackConsent?.details ?? this.trackPreview)
    displayedMapScene = $derived.by(() =>
        this.displayedTrackPreview && !this.trackTileInFlight
            ? createMapDrawing(
                  this.mapView.map,
                  {
                      tileSet: this.mapView.tileSet,
                      inventory: this.construction.inventoryAfter(this.displayedTrackPreview)
                  },
                  this.mapView.layouts,
                  this.mapView.markerImages
              )
            : this.mapScene
    )
    displayedMapTokens = $derived.by(() =>
        this.displayedTrackPreview && !this.trackTileInFlight
            ? stationMapTokens(this.displayedTrackPreview, this.mapView.stations)
            : this.stationPreview
              ? stationMapTokens(this.stationDisplayState, this.mapView.stations)
              : this.mapTokens
    )
    selectTrackLocation(locationId: string) {
        assert(
            this.canBuildTrack && this.trackLocationIds.includes(locationId),
            'No legal construction at this location'
        )
        this.trackDraft = chooseTrackLocation(locationId)
        const choices = this.trackChoicesByLocation.get(locationId)!
        if (new Set(choices.map((choice) => choice.definitionId)).size === 1) {
            this.trackDraft = chooseTrackTile(this.trackDraft, choices[0].definitionId, choices.slice(0, 1), 'auto')
            this.trackTileInFlight = true
        }
        this.mapInspection = undefined
    }
    selectTrackTile(definitionId: string) {
        assert(
            this.canBuildTrack && this.trackSelection.locationId,
            'Choose a construction location'
        )
        const choices = this.trackChoices.filter((choice) => choice.definitionId === definitionId)
        assert(choices.length, 'No legal placement for this tile')
        this.trackDraft = chooseTrackTile(this.trackDraft, definitionId, choices)
    }
    previewTrackTile(definitionId: string) {
        this.selectTrackTile(definitionId)
        this.trackDraft = chooseTrackTile(
            this.trackDraft,
            definitionId,
            this.trackPlacements.slice(0, 1)
        )
    }
    rotateTrackPreview() {
        assert(this.canBuildTrack && this.trackPreview, 'Choose a track tile to rotate')
        const preview = this.trackPreview
        const index = this.trackPlacements.findIndex(
            (choice) =>
                choice.rotation === preview.rotation &&
                JSON.stringify(choice.nodeMapping) === JSON.stringify(preview.nodeMapping)
        )
        const next = [
            ...this.trackPlacements.slice(index + 1),
            ...this.trackPlacements.slice(0, index + 1)
        ].find((choice) => choice.rotation !== preview.rotation)
        if (next) this.selectTrackPlacement(next)
    }
    cancelTrack() {
        this.trackDraft = {}
    }
    selectTrackPlacement(request: TrackRequest) {
        assert(
            this.canBuildTrack &&
                this.trackSelection.definitionId?.value === request.definitionId &&
                this.construction.evaluate(request).details,
            'Choose a legal tile rotation'
        )
        this.trackDraft = chooseTrackPlacement(this.trackDraft, request)
    }
    backTrack() {
        this.trackDraft = backFromTrack(this.trackDraft)
    }
    async confirmTrack() {
        const preview = this.trackPreview
        assert(this.canBuildTrack && preview, 'Choose a legal track placement')
        const power = this.privateTrackPowerSelection?.value
        if (power) {
            this.selectPrivateTile({ ...power, details: preview })
            await this.confirmCompanyDecision()
            return
        }
        const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = preview
        await this.applyAction(
            this.createPlayerAction(
                preview.consentPlayerId && preview.consentPlayerId !== this.myPlayer?.id
                    ? RequestTrackConsent
                    : LayTile,
                {
                    companyId,
                    locationId,
                    definitionId,
                    rotation,
                    nodeMapping,
                    expectedCost: cost
                }
            )
        )
    }
    override shouldAutoStepAction(action: GameAction, next?: GameAction) {
        return shouldContinueHistoryStep(action, next)
    }
    operatingStep = $derived.by(() => operatingStepIndex(this.financialState.machineState))
    private skippingOperatingSteps = $state(false)
    canSkipToOperatingStep(target: number): boolean {
        const current = this.operatingStep
        return current !== undefined && target > current && target <= 2 &&
            !this.skippingOperatingSteps && !this.busy && !this.updatingVisibleState &&
            !this.isViewingHistory && !this.hasActionDraft &&
            !this.financialState.purchaseOffer && !this.financialState.trackConsent &&
            !this.financialState.privateTrackLay &&
            this.validActionTypes.includes(current === 0 ? 'FinishTrack' : 'FinishStations')
    }
    async skipToOperatingStep(target: number) {
        assert(this.canSkipToOperatingStep(target), 'This operating step cannot be skipped to')
        const operatingSet = this.financialState.operatingSet
        const companyId = this.financialState.trackStep?.companyId ?? this.financialState.stationStep?.companyId
        this.skippingOperatingSteps = true
        try {
            while (this.operatingStep !== undefined && this.operatingStep < target) {
                if (this.operatingStep === 0) await this.finishTrack()
                else if (this.operatingStep === 1 && this.validActionTypes.includes('FinishStations')) await this.finishStations()
                else break
                await this.waitForVisibleTransitionSettled()
                const state = this.financialState
                if (state.operatingSet?.number !== operatingSet?.number ||
                    state.operatingSet?.roundNumber !== operatingSet?.roundNumber ||
                    (state.trackStep?.companyId ?? state.stationStep?.companyId) !== companyId ||
                    state.purchaseOffer || state.trackConsent || state.privateTrackLay) break
            }
        } finally {
            this.skippingOperatingSteps = false
        }
    }
    async finishTrack() {
        const companyId = this.financialState.trackStep?.companyId
        assert(
            companyId &&
                !this.trackSelection.locationId &&
                this.validActionTypes.includes('FinishTrack') &&
                !this.busy &&
                !this.isViewingHistory,
            'Finish or cancel the construction selection'
        )
        await this.applyAction(this.createPlayerAction(FinishTrack, { companyId }))
    }
    get passing() {
        return this.rules.stockRules.round.passing
    }
    private readonly historicalMaps: HistoricalMaps
    historicalMap: HistoricalMap | undefined = $derived.by(() => {
        this.financialState
        this.updatingVisibleState
        return undefined
    })
    previewHistoryMap(action: GameAction) {
        if (this.busy || this.updatingVisibleState) return
        if (this.historicalMap?.actionId === action.id) {
            this.historicalMap = undefined
            return
        }
        const context = this.history.visibleContext
        assert(EighteenXXStateValidator.Check(context.state), 'Historical map requires financial state')
        this.historicalMap = this.historicalMaps.preview(
            context.state, context.actions, action
        )
    }
    closeHistoricalMap() {
        this.historicalMap = undefined
    }
    financialState = $derived(requireEighteenXXState(this.gameState))
    mapScene = $derived.by(() =>
        createMapDrawing(
            this.mapView.map,
            { tileSet: this.mapView.tileSet, inventory: this.financialState.tileInventory },
            this.mapView.layouts,
            this.mapView.markerImages
        )
    )
    selectMap(selection: MapSelection, allowInspection = true) {
        if (this.showTrackChoices) {
            if (this.canBuildTrack && this.trackLocationIds.includes(selection.locationId)) {
                if (this.trackPreview?.locationId === selection.locationId) this.rotateTrackPreview()
                else this.selectTrackLocation(selection.locationId)
            }
            return
        }
        if (
            this.canRunTrains &&
            this.routeEditor.trainId &&
            selection.kind === 'path' &&
            this.routeEditor.extensions.some(
                (path) =>
                    path.locationId === selection.locationId && path.pathId === selection.pathId
            )
        )
            this.appendRoutePath(selection)
        else if (
            this.canRunTrains &&
            this.routeEditor.trainId &&
            !this.routeEditor.start &&
            (selection.kind === 'node' || selection.kind === 'slot') &&
            this.routeEditor.centers.some(
                (center) =>
                    center.locationId === selection.locationId && center.nodeId === selection.nodeId
            )
        )
            this.selectRouteStart({
                locationId: selection.locationId,
                nodeId: selection.nodeId
            })
        else if (this.canPlaceStation && this.stationLocationIds.includes(selection.locationId)) {
            const location = this.mapScene.locations.find((entry) => entry.location.id === selection.locationId)
            assertExists(location, 'Station placement requires a map location')
            const separateCities = location.face.nodes.filter((node) => node.kind === 'city').length > 1
            if (separateCities && selection.kind !== 'slot' && selection.kind !== 'node') return
            const choice = this.stationChoices.find(
                (choice) => choice.position.locationId === selection.locationId &&
                    (!separateCities ||
                        ((selection.kind === 'slot' || selection.kind === 'node') &&
                            choice.position.nodeId === selection.nodeId))
            )
            if (choice) {
                this.selectStationPosition(choice)
                void this.confirmStation()
            }
        } else if (allowInspection) this.inspectMap(selection)
    }
    mapTokens = $derived.by(() => stationMapTokens(this.financialState, this.mapView.stations))
    tileCounts = $derived.by(() => this.mapView.tileSet.counts(this.financialState.tileInventory))
    private mapInspection: { selection: MapSelection; face: TileFace } | undefined = $state.raw()
    mapSelection = $derived.by(() => {
        if (this.updatingVisibleState) return undefined
        const constructionLocation = this.trackSelection.locationId?.value
        if (constructionLocation) return { kind: 'hex', locationId: constructionLocation } as const
        const stationPosition = this.stationSelection.placement?.value.position
        if (stationPosition) return { kind: 'slot', ...stationPosition } as const
        const inspection = this.mapInspection
        if (
            this.updatingVisibleState ||
            !inspection ||
            !isMapSelectionValid(this.mapScene, inspection.selection)
        )
            return undefined
        const face = this.mapScene.locations.find(
            (entry) => entry.location.id === inspection.selection.locationId
        )?.face
        return inspection.selection.kind === 'hex' || face === inspection.face
            ? inspection.selection
            : undefined
    })
    private mapStyles: Record<string, 'classic' | 'muted'> = $state({})
    mapStyle = $derived(this.myPlayer ? (this.mapStyles[this.myPlayer.id] ?? 'classic') : 'classic')
    inspectMap(selection: MapSelection) {
        assert(isMapSelectionValid(this.mapScene, selection), 'Invalid map selection')
        const entry = this.mapScene.locations.find(
            (entry) => entry.location.id === selection.locationId
        )
        assertExists(entry, 'Selection requires a map location')
        this.mapInspection = { selection, face: entry.face }
    }
    setMapStyle(style: 'classic' | 'muted') {
        assertExists(this.myPlayer, 'A map preference requires a player')
        this.mapStyles[this.myPlayer.id] = style
    }
    sharesToFloat(companyId: string) {
        return this.rules.companyRules.sharesToFloat?.(this.financialState, companyId)
    }
    stockCompanyName(companyId: string) {
        return getCompany(this.financialState, companyId).name
    }
    get stockCompanies() {
        const order = stockMarketOrder(this.financialState.stockMarket)
        const rank = new Map(order.map((id, index) => [id, index]))
        return this.financialState.companies.filter((company) => company.started)
            .sort((left, right) =>
                (rank.get(left.id) ?? order.length) - (rank.get(right.id) ?? order.length))
    }
    private stockActionDraft: StockActionSelection = $state({})
    stockMenu = $derived(
        this.updatingVisibleState || this.isViewingHistory
            ? undefined
            : this.stockActionDraft.action?.value.menu
    )
    stockActionBuyer = $derived(this.stockActionDraft.action?.value.buyer)
    selectedSaleCompany = $derived(this.stockActionDraft.saleCompany?.value)
    chooseStockMenu(menu: StockAction | undefined, buyer?: Owner) {
        this.assertSelectionAvailable(this.myPlayer?.id)
        this.cancelSelection()
        this.stockActionDraft = menu ? chooseStockAction(menu, buyer) : {}
    }
    chooseStockSaleCompany(companyId: string) {
        this.assertSelectionAvailable(this.myPlayer?.id)
        this.stockActionDraft = chooseSaleCompany(this.stockActionDraft, companyId)
    }
    backFromStockMenu() {
        this.stockActionDraft = backFromStockAction(this.stockActionDraft)
    }
    startChoices = $derived.by(() => {
        const state = this.financialState
        const playerId = this.myPlayer?.id
        if (
            !playerId ||
            this.updatingVisibleState ||
            this.isViewingHistory ||
            state.machineState !== 'StockRound' ||
            state.stockRound.turn.bought
        )
            return []
        return this.rules.stockRules.buyers(state, playerId).flatMap((buyer) =>
            state.companies
                .filter((company) => !company.started && !company.closed && company.shareCount)
                .map((company) => {
                    const request = { playerId, buyer, companyId: company.id }
                    const prices = this.rules.companyRules
                        .startMarketSpaces(state, company.id)
                        .map((marketSpaceId) => ({
                            marketSpaceId,
                            result: evaluateCompanyStart(
                                state,
                                { ...request, marketSpaceId },
                                this.rules.stockRules,
                                this.rules.companyRules
                            )
                        }))
                    return { request, prices }
                })
                .filter((choice) => choice.prices.length > 0)
        )
    })
    selectedStartCompany = $derived(
        this.selection?.kind === 'start' && !this.updatingVisibleState && !this.isViewingHistory
            ? this.selection.stages.company?.value
            : undefined
    )
    selectedStartRequest = $derived(
        this.selection?.kind === 'start' && !this.updatingVisibleState && !this.isViewingHistory
            ? companyStartRequest(this.selection.stages)
            : undefined
    )
    selectedStartPrices = $derived(
        this.startChoices.find(
            (choice) =>
                this.selectedStartCompany &&
                choice.request.companyId === this.selectedStartCompany.companyId &&
                sameOwner(choice.request.buyer, this.selectedStartCompany.buyer)
        )?.prices ?? []
    )
    selectedStartResult = $derived.by(() =>
        this.selectedStartRequest
            ? evaluateCompanyStart(
                  this.financialState,
                  this.selectedStartRequest,
                  this.rules.stockRules,
                  this.rules.companyRules
              )
            : undefined
    )
    selectedPurchaseFlotation = $derived.by(() =>
        this.selectedPurchaseDetails
            ? flotationAfterPurchase(
                  this.financialState,
                  this.selectedPurchaseDetails,
                  this.rules.companyRules
              )
            : undefined
    )
    selectCompanyStart(request: Omit<CompanyStartRequest, 'marketSpaceId'>) {
        this.assertSelectionAvailable(request.playerId)
        this.selection = { kind: 'start', stages: chooseStartCompany(request) }
    }
    selectStartPrice(marketSpaceId: string) {
        this.assertSelectionAvailable(this.myPlayer?.id)
        assert(this.selection?.kind === 'start', 'Choose a company before its starting price')
        this.selection = {
            kind: 'start',
            stages: chooseStartPrice(this.selection.stages, marketSpaceId)
        }
    }
    backFromStart() {
        assert(this.selection?.kind === 'start', 'No company start selected')
        const stages = backFromCompanyStart(this.selection.stages)
        this.selection = stages.company ? { kind: 'start', stages } : undefined
    }
    async confirmStart() {
        this.assertSelectionAvailable(this.myPlayer?.id)
        const details = this.selectedStartResult?.details
        assertExists(details, 'Choose an available company and starting price')
        await this.applyAction(
            this.createPlayerAction(StartCompany, {
                buyer: details.buyer,
                companyId: details.companyId,
                marketSpaceId: details.marketSpaceId,
                expectedPrice: details.price
            })
        )
    }
    purchaseChoices = $derived.by(() => {
        const state = this.financialState
        const playerId = this.myPlayer?.id
        if (
            !playerId ||
            this.updatingVisibleState ||
            this.isViewingHistory ||
            state.machineState !== 'StockRound' ||
            state.stockRound.turn.bought
        )
            return []
        return this.rules.stockRules.buyers(state, playerId).flatMap((buyer) =>
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
                        result: evaluateSharePurchase(state, request, this.rules.stockRules)
                    }
                })
        )
    })
    saleChoices = $derived.by(() => {
        const state = this.financialState
        const playerId = this.myPlayer?.id
        if (
            !playerId ||
            this.updatingVisibleState ||
            this.isViewingHistory ||
            state.machineState !== 'StockRound'
        )
            return []
        return this.rules.stockRules.sellers(state, playerId).flatMap((seller) =>
            state.companies.flatMap((company) => {
                const owned = sharesOwned(state, company.id, seller)
                return Array.from({ length: owned }, (_, index) => {
                    const sale = { companyId: company.id, shares: index + 1 }
                    const request = { playerId, seller, sales: [sale] }
                    return {
                        sale,
                        request,
                        result: evaluateShareSale(state, request, this.rules.stockRules)
                    }
                })
            })
        )
    })
    selectedPurchaseDetails = $derived.by(() => {
        if (
            this.selection?.kind !== 'purchase' ||
            this.updatingVisibleState ||
            this.isViewingHistory
        )
            return undefined
        return evaluateSharePurchase(this.financialState, this.selection.request, this.rules.stockRules)
            .details
    })
    stockSaleSelection = $derived.by(() => {
        if (this.updatingVisibleState || this.isViewingHistory) return undefined
        if (this.selection?.kind === 'sale')
            return { source: 'manual' as const, request: this.selection.request }
        if (this.stockMenu !== 'sell' || !this.selectedSaleCompany) return undefined
        const choices = this.saleChoices.filter((choice) =>
            choice.sale.companyId === this.selectedSaleCompany && choice.result.details)
        if (choices.length === 1 && choices[0].sale.shares === 1)
            return { source: 'auto' as const, request: choices[0].request }
        return undefined
    })
    selectedSale = $derived(this.stockSaleSelection?.request)
    selectedSaleResult = $derived.by(() =>
        this.selectedSale
            ? evaluateShareSale(this.financialState, this.selectedSale, this.rules.stockRules)
            : undefined
    )
    trades = $derived(
        this.actions
            .slice(0, this.gameState.actionCount)
            .filter(
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
    stockTurnSales = $derived.by(() => {
        const boundary = this.trades.findLastIndex((action) =>
            isFinishStockTurn(action) || isCompleteStockRound(action))
        const totals = new Map<string, number>()
        for (const action of this.trades.slice(boundary + 1)) {
            if (!isSellShares(action)) continue
            for (const sale of action.sales)
                totals.set(sale.companyId, (totals.get(sale.companyId) ?? 0) + sale.shares)
        }
        return [...totals].map(([companyId, shares]) => ({ companyId, shares }))
    })
    mustSell = $derived.by(() =>
        this.financialState.machineState === 'StockRound' && this.myPlayer
            ? exceedsStockLimits(
                  this.financialState,
                  { kind: 'player', playerId: this.myPlayer.id },
                  this.rules.stockRules
              )
            : false
    )
    certificateWeight = (certificate: Portfolio[number]) =>
        this.rules.stockRules.certificateWeight(this.financialState, certificate)
    playerCertificates(playerId: string) {
        const owner = { kind: 'player', playerId } as const
        return {
            count: stockCertificateCount(this.financialState, owner, this.rules.stockRules),
            limit: this.rules.stockRules.certificateLimit(this.financialState, owner)
        }
    }
    ownerName(owner: Owner): string {
        if (owner.kind === 'player') return this.getPlayerName(owner.playerId)
        return owner.kind === 'bank'
            ? this.financialState.bank.name
            : getCompany(this.financialState, owner.companyId).name
    }
    selectPurchase(request: PurchaseRequest) {
        this.assertSelectionAvailable(request.playerId)
        assert(
            evaluateSharePurchase(this.financialState, request, this.rules.stockRules).details,
            'Purchase is unavailable'
        )
        this.selection = { kind: 'purchase', request }
    }
    selectSale(request: SaleRequest) {
        this.assertSelectionAvailable(request.playerId)
        assert(request.sales.length === 1, 'Select one company per sale')
        this.selection = { kind: 'sale', request }
    }
    removeSale(companyId: string) {
        if (this.selection?.kind !== 'sale') return
        const sales = this.selection.request.sales.filter((sale) => sale.companyId !== companyId)
        this.selection = sales.length
            ? { kind: 'sale', request: { ...this.selection.request, sales } }
            : undefined
    }
    cancelSelection() {
        this.selection = undefined
    }
    async confirmPurchase() {
        this.assertSelectionAvailable(this.myPlayer?.id)
        const details = this.selectedPurchaseDetails
        assertExists(details, 'Select an available purchase')
        await this.applyAction(
            this.createPlayerAction(BuyShares, {
                buyer: details.buyer,
                certificateId: details.certificateId,
                expectedPrice: details.price
            })
        )
    }
    async confirmSale() {
        this.assertSelectionAvailable(this.myPlayer?.id)
        const playerId = this.myPlayer?.id
        const roundNumber = this.financialState.stockRound.number
        const details = this.selectedSaleResult?.details
        assertExists(details, 'Select an available sale')
        const sales: ShareSale[] = details.sales.map(({ companyId, shares }) => ({
            companyId,
            shares
        }))
        await this.applyAction(
            this.createPlayerAction(SellShares, {
                seller: details.seller,
                sales,
                expectedProceeds: details.proceeds
            })
        )
        await this.waitForVisibleTransitionSettled()
        if (
            this.myPlayer?.id === playerId &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            this.financialState.stockRound.number === roundNumber &&
            this.saleChoices.some((choice) => choice.result.details)
        ) {
            this.stockActionDraft = chooseStockAction('sell', undefined, 'auto')
        }
    }
    async finishTurn() {
        this.assertSelectionAvailable(this.myPlayer?.id)
        assert(
            !this.selection && this.validActionTypes.includes('FinishStockTurn'),
            'Finish the current selection first'
        )
        await this.applyAction(this.createPlayerAction(FinishStockTurn, {}))
    }
    override beforeNewState() {
        this.mapInspection = undefined
        this.automaticRoutes = undefined
        this.drafts.clear()
    }
    get hasActionDraft(): boolean {
        return this.drafts.pending()
    }
    override async undo() {
        if (this.busy || this.isViewingHistory) return
        if (this.drafts.unwind()) return
        this.stockActionDraft = {}
        await super.undo()
    }
    private registerDrafts() {
        this.drafts.register({
            pending: () => !!this.trainBuyingDraft.source,
            unwind: () => {
                if (!this.trainBuyingDraft.source) return false
                this.trainBuyingDraft = backFromTrainBuying(this.trainBuyingDraft)
                return true
            },
            clear: () => { this.trainBuyingDraft = {} }
        })
        this.drafts.register(this.offers)
        this.drafts.register(this.waterfall)
        this.drafts.register(clearableDraft(() => !!this.companyDraft, () => { this.companyDraft = undefined }))
        this.drafts.register({
            pending: () => !!this.privateActionSelection,
            unwind: () => {
                if (!this.privateActionSelection && !this.privateActionStages.power &&
                    !(this.privateTrackPowerSelection && this.trackDraft.locationId)) return false
                if (this.trackDraft.locationId) this.trackDraft = {}
                else if (this.privateActionStages.power?.source === 'manual')
                    this.privateActionStages = { source: this.privateActionStages.source }
                else this.privateActionStages = {}
                return true
            },
            clear: () => { this.privateActionStages = {} }
        })
        this.drafts.register(this.privates)
        this.drafts.register(this.discard)
        this.drafts.register(this.earnings)
        this.drafts.register(clearableDraft(() => this.routeEditor.hasDraft, () => this.routeEditor.clear()))
        this.drafts.register(clearableDraft(() => !!this.trainDraft, () => { this.trainDraft = undefined }))
        this.drafts.register({
            pending: () => !!this.stationDraft.stationId,
            unwind: () => {
                if (!this.stationDraft.placement && this.stationDraft.stationId?.source !== 'manual') return false
                this.stationDraft = {}
                return true
            },
            clear: () => { this.stationDraft = {} }
        })
        this.drafts.register(clearableDraft(() => !!this.trackDraft.locationId, () => { this.trackDraft = {} }))
        this.drafts.register({
            pending: () => false,
            unwind: () => {
                if (this.stockMenu !== 'sell' || !this.selectedSaleCompany) return false
                this.cancelSelection()
                this.backFromStockMenu()
                return true
            },
            clear: () => {}
        })
        this.drafts.register({
            pending: () => !!this.selection,
            unwind: () => {
                if (!this.selection) return false
                if (this.selection.kind === 'start') this.backFromStart()
                else this.cancelSelection()
                return true
            },
            clear: () => this.cancelSelection()
        })
        this.drafts.register({
            pending: () => this.stockActionDraft.action?.source === 'manual' ||
                this.stockActionDraft.saleCompany?.source === 'manual',
            unwind: () => {
                if (this.stockActionDraft.action?.source !== 'manual') return false
                this.backFromStockMenu()
                return true
            },
            clear: () => { this.stockActionDraft = {} }
        })
    }
    private assertSelectionAvailable(playerId: string | undefined) {
        assert(
            !this.busy && !this.isViewingHistory && !this.updatingVisibleState,
            'Stock selection is unavailable'
        )
        assert(
            playerId !== undefined && playerId === this.myPlayer?.id,
            'Select a trade for the acting player'
        )
    }
}
export function createEighteenXXSessionClass(
    rules: EighteenXXTitleRules,
    mapView: MapViewDefinition
): new (options: SessionOptions) => EighteenXXSession {
    return class extends EighteenXXSession {
        constructor(options: SessionOptions) {
            super(options, rules, mapView)
        }
    }
}
export function requireEighteenXXSession(
    session: GameSession<GameState, HydratedGameState>
): EighteenXXSession {
    assert(session instanceof EighteenXXSession, 'Expected an 18xx session')
    return session
}
