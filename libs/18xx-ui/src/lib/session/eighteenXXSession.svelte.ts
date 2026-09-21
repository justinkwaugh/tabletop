import { RoutesModule } from './routesModule.svelte.js'
import { StationsModule } from './stationsModule.svelte.js'
import { TrainBuyingModule } from './trainBuyingModule.svelte.js'
import { TrainFundingModule } from './trainFundingModule.svelte.js'
import { PrivatesModule } from './privatesModule.svelte.js'
import { OfferAuctionModule } from './offerAuctionModule.svelte.js'
import { WaterfallAuctionModule } from './waterfallAuctionModule.svelte.js'
import type { ModuleSession } from './moduleSession.js'
import { EarningsModule } from './earningsModule.svelte.js'
import { DiscardModule } from './discardModule.svelte.js'
import { CompanyDecisionsModule } from './companyDecisionsModule.svelte.js'
import { PrivateActionsModule } from './privateActionsModule.svelte.js'
import { TrackModule } from './trackModule.svelte.js'
import { LocalSelections } from './localSelections.js'
import { shouldContinueHistoryStep } from '../table/historyNavigation.js'
import { operatingStepIndex } from '../table/operatingStep.js'
import { operatingHistory } from '../table/operatingHistory.js'
import { createMarketAnimationSource } from '../stock/marketAnimationSource.js'
import {
    hasManualStagedSelection
} from '@tabletop/frontend-components'
import { EighteenXXPreferenceDefinition, type EighteenXXPreferences } from '@tabletop/18xx'
import type { TitlePreferences } from '@tabletop/frontend-components'
import { EighteenXXStateValidator } from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import { HistoricalMaps, type HistoricalMap } from '../maps/historicalMap.js'
import {
    StockActionStageOrder,
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
import {
    purchaseChoices
} from '@tabletop/18xx'
import { GameStorage } from '@tabletop/common'
import {
    FinishOperatingTurn,
    finishOperatingTurnReason
} from '@tabletop/18xx'
import {
    trainsOwnedBy
} from '@tabletop/18xx'
import {
    FinishStations,
    TrackNetwork,
    RailwayMapState
} from '@tabletop/18xx'
import {
    FinishTrack
} from '@tabletop/18xx'
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
    protected readonly localSelections = new LocalSelections()
    private get localHotseat() {
        return !!this.game.hotseat && this.game.storage === GameStorage.Local
    }
    private readonly moduleSession: ModuleSession<HydratedEighteenXXState, EighteenXXTitleRules> = ((
        session: EighteenXXSession
    ) => ({
        get state() { return session.financialState },
        get rules() { return session.rules },
        get validActionTypes() { return session.validActionTypes },
        get publishing() { return session.updatingVisibleState },
        get viewingHistory() { return session.isViewingHistory },
        get selectionsVisible() { return !session.updatingVisibleState && !session.isViewingHistory },
        get interactive() { return !session.busy && !session.updatingVisibleState && !session.isViewingHistory },
        get playerId() { return session.myPlayer?.id },
        get actingPlayerIds() {
            return session.localHotseat ? session.financialState.activePlayerIds
                : session.myPlayer ? [session.myPlayer.id] : []
        },
        canActFor: (playerId) => session.localHotseat || session.myPlayer?.id === playerId,
        get recordedActions() { return session.actions.slice(0, session.gameState.actionCount) },
        settled: () => session.waitForVisibleTransitionSettled(),
        createPlayerAction: (schema, data) => session.createPlayerAction(schema, data),
        applyAction: (action) => session.applyAction(action)
    }))(this)
    readonly offers = new OfferAuctionModule(this.moduleSession)
    readonly waterfall = new WaterfallAuctionModule(this.moduleSession)
    readonly privates = new PrivatesModule(this.moduleSession)
    readonly trainFunding = new TrainFundingModule(this.moduleSession)
    readonly decisions = new CompanyDecisionsModule(this.moduleSession)
    readonly privateActions: PrivateActionsModule = new PrivateActionsModule(this.moduleSession, this.decisions, {
        undo: (): boolean => this.track.stages.undo(),
        clear: () => this.track.stages.clear()
    })
    readonly track: TrackModule = new TrackModule(
        this.moduleSession,
        () => this.mapView,
        this.privateActions,
        this.decisions,
        () => { this.mapInspection = undefined }
    )
    readonly trainBuying = new TrainBuyingModule(this.moduleSession, () => this.decisions.purchaseOptions)
    get requiresStationTokenChoice(): boolean {
        return false
    }
    readonly stations = new StationsModule(
        this.moduleSession,
        () => { this.mapInspection = undefined },
        () => this.requiresStationTokenChoice
    )
    readonly routes = new RoutesModule(
        this.moduleSession,
        (selection) => this.inspectMap(selection),
        () => this.networkRoutes
    )
    readonly earnings = new EarningsModule(this.moduleSession)
    readonly discard = new DiscardModule(this.moduleSession)
    constructor(
        options: SessionOptions,
        private readonly rules: EighteenXXTitleRules,
        readonly mapView: MapViewDefinition
    ) {
        super(options)
        this.historicalMaps = new HistoricalMaps(mapView)
        this.registerLocalSelections()
    }
    auctionLotsFor(state: EighteenXXState) {
        return this.rules.offerAuctionRules?.lots(state) ?? this.rules.auctionRules?.lots(state) ?? []
    }
    protected override getActivePlayers() {
        return this.gameState.activePlayerIds.flatMap((id) =>
            this.game.players.filter((player) => player.id === id)
        )
    }
    get privatePurchaseHeading(): string | undefined { return 'Available privates' }
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
            !this.trainBuying.depotSelection &&
            this.validActionTypes.includes('FinishOperatingTurn')
    )
    async finishOperatingTurn() {
        const companyId = this.financialState.trainPurchaseStep?.companyId
        assert(this.canFinishOperatingTurn && companyId, 'The operating turn cannot finish yet')
        await this.applyAction(this.createPlayerAction(FinishOperatingTurn, { companyId }))
    }
    availableTrainDefinitionIds = $derived.by(() => this.rules.trainRules.availableDefinitions(this.financialState))
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
                  this.stations.displayState,
                  this.networkCompanyId
              )
            : undefined
    )
    networkRoutes = $derived.by(() =>
        this.showTrackAccess && !this.updatingVisibleState && !this.track.preview && this.network
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
    displayedMapScene = $derived.by(() =>
        this.track.displayedPreview && !this.track.tileInFlight
            ? createMapDrawing(
                  this.mapView.map,
                  {
                      tileSet: this.mapView.tileSet,
                      inventory: this.track.construction.inventoryAfter(this.track.displayedPreview)
                  },
                  this.mapView.layouts,
                  this.mapView.markerImages
              )
            : this.mapScene
    )
    displayedMapTokens = $derived.by(() =>
        this.track.displayedPreview && !this.track.tileInFlight
            ? stationMapTokens(this.track.displayedPreview, this.mapView.stations)
            : this.stations.preview
              ? stationMapTokens(this.stations.displayState, this.mapView.stations)
              : this.mapTokens
    )
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
                if (this.operatingStep === 0) await this.track.finish()
                else if (this.operatingStep === 1 && this.validActionTypes.includes('FinishStations')) await this.stations.finish()
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
        if (this.track.showChoices) {
            if (this.track.canBuild && this.track.locationIds.includes(selection.locationId)) {
                if (this.track.preview?.locationId === selection.locationId) this.track.rotatePreview()
                else this.track.selectLocation(selection.locationId)
            }
            return
        }
        if (
            this.routes.canRun &&
            this.routes.editor.trainId &&
            selection.kind === 'path' &&
            this.routes.editor.extensions.some(
                (path) =>
                    path.locationId === selection.locationId && path.pathId === selection.pathId
            )
        )
            this.routes.appendPath(selection)
        else if (
            this.routes.canRun &&
            this.routes.editor.trainId &&
            !this.routes.editor.start &&
            (selection.kind === 'node' || selection.kind === 'slot') &&
            this.routes.editor.centers.some(
                (center) =>
                    center.locationId === selection.locationId && center.nodeId === selection.nodeId
            )
        )
            this.routes.selectStart({
                locationId: selection.locationId,
                nodeId: selection.nodeId
            })
        else if (this.stations.canPlace && this.stations.locationIds.includes(selection.locationId)) {
            const location = this.mapScene.locations.find((entry) => entry.location.id === selection.locationId)
            assertExists(location, 'Station placement requires a map location')
            const separateCities = location.face.nodes.filter((node) => node.kind === 'city').length > 1
            if (separateCities && selection.kind !== 'slot' && selection.kind !== 'node') return
            const choice = this.stations.choices.find(
                (choice) => choice.position.locationId === selection.locationId &&
                    (!separateCities ||
                        ((selection.kind === 'slot' || selection.kind === 'node') &&
                            choice.position.nodeId === selection.nodeId))
            )
            if (choice) {
                this.stations.selectPosition(choice)
                void this.stations.confirm()
            }
        } else if (allowInspection) this.inspectMap(selection)
    }
    mapTokens = $derived.by(() => stationMapTokens(this.financialState, this.mapView.stations))
    tileCounts = $derived.by(() => this.mapView.tileSet.counts(this.financialState.tileInventory))
    private mapInspection: { selection: MapSelection; face: TileFace } | undefined = $state.raw()
    mapSelection = $derived.by(() => {
        if (this.updatingVisibleState) return undefined
        const constructionLocation = this.track.selection.locationId?.value
        if (constructionLocation) return { kind: 'hex', locationId: constructionLocation } as const
        const stationPosition = this.stations.selection.placement?.value.position
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
        this.localSelections.clear()
    }
    get hasActionDraft(): boolean {
        return this.localSelections.hasManual()
    }
    override async undo() {
        if (this.busy || this.isViewingHistory) return
        if (this.localSelections.undo()) return
        this.stockActionDraft = {}
        await super.undo()
    }
    private registerLocalSelections() {
        const { localSelections } = this
        localSelections.register(this.trainBuying.sourceStages)
        localSelections.register(this.offers.choice)
        localSelections.register(this.waterfall.choice)
        localSelections.register(this.decisions.choice)
        localSelections.register(this.privateActions)
        localSelections.register(this.privates.exchangeChoice)
        localSelections.register(this.discard.choice)
        localSelections.register(this.earnings.choice)
        localSelections.register(this.routes)
        localSelections.register(this.trainBuying.depotChoice)
        localSelections.register(this.stations.stages)
        localSelections.register(this.track.stages)
        localSelections.register({
            hasManual: () => false,
            undo: () => {
                if (this.stockMenu !== 'sell' || !this.selectedSaleCompany) return false
                this.cancelSelection()
                this.backFromStockMenu()
                return true
            },
            clear: () => {}
        })
        localSelections.register({
            hasManual: () => !!this.selection,
            undo: () => {
                if (!this.selection) return false
                if (this.selection.kind === 'start') this.backFromStart()
                else this.cancelSelection()
                return true
            },
            clear: () => this.cancelSelection()
        })
        localSelections.register({
            hasManual: () => hasManualStagedSelection(this.stockActionDraft, StockActionStageOrder),
            undo: () => {
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
