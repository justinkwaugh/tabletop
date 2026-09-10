import { RouteEditor } from './routeEditor.svelte.js'
import { RunTrains, type RouteRules, type RevenueCenter, type RoutePath } from '@tabletop/18xx'
import {
    BuyTrain,
    TrainPurchase,
    isBuyTrain,
    trainsOwnedBy,
    type TrainRules,
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
    type StationRules,
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
    type TrackRules,
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
import { stationMapTokens, type MapViewDefinition } from '../maps/stationPresentation.js'
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
    type CompanyRules,
    type TileFace,
    type CompanyStartRequest,
    BuyShares,
    SellShares,
    FinishStockTurn,
    isBuyShares,
    isSellShares,
    evaluateSharePurchase,
    evaluateShareSale,
    requireFinanceExampleState,
    getCompany,
    sharesOwned,
    sameOwner,
    exceedsStockLimits,
    type PurchaseRequest,
    type SaleRequest,
    type ShareSale,
    type StockRules,
    type Owner,
    type Portfolio
} from '@tabletop/18xx'

type SessionOptions = ConstructorParameters<typeof GameSession<GameState, HydratedGameState>>[0]
type Selection =
    | { kind: 'purchase'; request: PurchaseRequest }
    | { kind: 'sale'; request: SaleRequest }
    | { kind: 'start'; stages: CompanyStartSelection }
export class FinanceExampleSession extends GameSession<GameState, HydratedGameState> {
    selection: Selection | undefined = $state()
    constructor(
        options: SessionOptions,
        private readonly stockRules: StockRules,
        private readonly companyRules: CompanyRules,
        readonly mapView: MapViewDefinition,
        private readonly trackRules: TrackRules,
        private readonly stationRules: StationRules,
        private readonly trainRules: TrainRules,
        private readonly routeRules: RouteRules
    ) {
        super(options)
    }
    routeEditor = $derived.by(() => new RouteEditor(this.financialState, this.routeRules))
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
        const routes = this.routeDraftVisible ? this.routeEditor.routes : (result?.routes ?? [])
        const overlays = routes.map((route, index) => ({
            id: route.trainId,
            color: ['#b24bce', '#15784e', '#d34b38', '#325aba'][index % 4],
            segments: route.paths
        }))
        if (this.routeDraftVisible && this.routeEditor.route)
            overlays.push({ id: 'route-draft', color: '#d58400', segments: this.routeEditor.paths })
        return overlays
    })
    displayedRoutes = $derived.by(() =>
        this.routeOverlays.length ? this.routeOverlays : this.networkRoutes
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
    private trainDraft: TrainPurchaseRequest | undefined = $state.raw()
    trainSelection = $derived.by(() =>
        !this.updatingVisibleState &&
        !this.isViewingHistory &&
        this.financialState.machineState === 'BuyingTrains'
            ? this.trainDraft
            : undefined
    )
    trainPurchase = $derived.by(() => new TrainPurchase(this.financialState, this.trainRules))
    trainOffers = $derived(this.trainPurchase.offers())
    trainPreview = $derived(
        this.trainSelection ? this.trainPurchase.evaluate(this.trainSelection).details : undefined
    )
    canBuyTrain = $derived(
        !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.validActionTypes.includes('BuyTrain')
    )
    trainPurchases = $derived(this.actions.slice(0, this.gameState.actionCount).filter(isBuyTrain))
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
    get trainDepot() {
        return this.trainRules.depot
    }
    trainLimit = $derived.by(() =>
        this.financialState.trainPurchaseStep
            ? this.trainRules.trainLimit(
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
        await this.applyAction(
            this.createPlayerAction(BuyTrain, {
                companyId: preview.companyId,
                trainId: preview.trainId,
                definitionId: preview.definitionId,
                expectedPrice: preview.price
            })
        )
    }
    private stationDraft: StationSelection = $state({})
    stationSelection = $derived.by(() =>
        !this.updatingVisibleState &&
        !this.isViewingHistory &&
        this.financialState.machineState === 'PlacingStation'
            ? this.stationDraft
            : {}
    )
    stationPlacement = $derived.by(
        () => new StationPlacement(this.financialState, this.stationRules)
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
        this.stationDraft = chooseStationPosition(this.stationDraft, request)
        this.inspectMap({ kind: 'slot', ...request.position })
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
            companyId && this.canPlaceStation && !this.stationSelection.stationId,
            'Finish or cancel the station selection'
        )
        await this.applyAction(this.createPlayerAction(FinishStations, { companyId }))
    }
    constructionActions = $derived(
        this.actions.slice(0, this.gameState.actionCount).filter(isLayTile)
    )
    private trackDraft: TrackSelection = $state({})
    trackSelection = $derived.by(() =>
        !this.updatingVisibleState &&
        !this.isViewingHistory &&
        this.financialState.machineState === 'LayingTrack'
            ? this.trackDraft
            : {}
    )
    construction = $derived.by(() => new TrackConstruction(this.financialState, this.trackRules))
    canBuildTrack = $derived(
        !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.validActionTypes.includes('FinishTrack')
    )
    trackChoicesByLocation = $derived.by(
        () =>
            new Map(
                this.canBuildTrack
                    ? this.mapView.map.definition.locations.map(
                          (location) =>
                              [location.id, this.construction.choices(location.id)] as const
                      )
                    : []
            )
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
    displayedMapScene = $derived.by(() =>
        this.trackPreview
            ? createMapDrawing(
                  this.mapView.map,
                  {
                      tileSet: this.mapView.tileSet,
                      inventory: this.construction.inventoryAfter(this.trackPreview)
                  },
                  this.mapView.layouts
              )
            : this.mapScene
    )
    displayedMapTokens = $derived.by(() =>
        this.trackPreview
            ? stationMapTokens(this.trackPreview, this.mapView.stations)
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
        this.inspectMap({ kind: 'hex', locationId })
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
        const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = preview
        await this.applyAction(
            this.createPlayerAction(LayTile, {
                companyId,
                locationId,
                definitionId,
                rotation,
                nodeMapping,
                expectedCost: cost
            })
        )
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
        return this.stockRules.round.passing
    }
    financialState = $derived(requireFinanceExampleState(this.gameState))
    mapScene = $derived.by(() =>
        createMapDrawing(
            this.mapView.map,
            { tileSet: this.mapView.tileSet, inventory: this.financialState.tileInventory },
            this.mapView.layouts
        )
    )
    mapTokens = $derived.by(() => stationMapTokens(this.financialState, this.mapView.stations))
    tileCounts = $derived.by(() => this.mapView.tileSet.counts(this.financialState.tileInventory))
    private mapInspection: { selection: MapSelection; face: TileFace } | undefined = $state.raw()
    mapSelection = $derived.by(() => {
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
        return this.stockRules.buyers(state, playerId).flatMap((buyer) =>
            state.companies
                .filter((company) => !company.started && !company.closed && company.shareCount)
                .map((company) => {
                    const request = { playerId, buyer, companyId: company.id }
                    const prices = this.companyRules
                        .startMarketSpaces(state, company.id)
                        .map((marketSpaceId) => ({
                            marketSpaceId,
                            result: evaluateCompanyStart(
                                state,
                                { ...request, marketSpaceId },
                                this.stockRules,
                                this.companyRules
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
                  this.stockRules,
                  this.companyRules
              )
            : undefined
    )
    selectedPurchaseFlotation = $derived.by(() =>
        this.selectedPurchaseDetails
            ? flotationAfterPurchase(
                  this.financialState,
                  this.selectedPurchaseDetails,
                  this.companyRules
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
        return this.stockRules.buyers(state, playerId).flatMap((buyer) =>
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
                        result: evaluateSharePurchase(state, request, this.stockRules)
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
        return this.stockRules.sellers(state, playerId).flatMap((seller) =>
            state.companies.flatMap((company) => {
                const owned = sharesOwned(state, company.id, seller)
                return Array.from({ length: owned }, (_, index) => {
                    const sale = { companyId: company.id, shares: index + 1 }
                    const request = { playerId, seller, sales: [sale] }
                    return {
                        sale,
                        request,
                        result: evaluateShareSale(state, request, this.stockRules)
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
        return evaluateSharePurchase(this.financialState, this.selection.request, this.stockRules)
            .details
    })
    selectedSale = $derived(
        this.selection?.kind === 'sale' && !this.updatingVisibleState && !this.isViewingHistory
            ? this.selection.request
            : undefined
    )
    selectedSaleResult = $derived.by(() =>
        this.selectedSale
            ? evaluateShareSale(this.financialState, this.selectedSale, this.stockRules)
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
    mustSell = $derived.by(() =>
        this.financialState.machineState === 'StockRound' && this.myPlayer
            ? exceedsStockLimits(
                  this.financialState,
                  { kind: 'player', playerId: this.myPlayer.id },
                  this.stockRules
              )
            : false
    )
    certificateWeight = (certificate: Portfolio[number]) =>
        this.stockRules.certificateWeight(this.financialState, certificate)
    ownerName(owner: Owner): string {
        if (owner.kind === 'player') return this.getPlayerName(owner.playerId)
        return owner.kind === 'bank'
            ? this.financialState.bank.name
            : getCompany(this.financialState, owner.companyId).name
    }
    selectPurchase(request: PurchaseRequest) {
        this.assertSelectionAvailable(request.playerId)
        assert(
            evaluateSharePurchase(this.financialState, request, this.stockRules).details,
            'Purchase is unavailable'
        )
        this.selection = { kind: 'purchase', request }
    }
    selectSale(request: SaleRequest) {
        this.assertSelectionAvailable(request.playerId)
        const existing =
            this.selection?.kind === 'sale' &&
            sameOwner(this.selection.request.seller, request.seller)
                ? this.selection.request.sales
                : []
        const chosen = request.sales[0]
        this.selection = {
            kind: 'sale',
            request: {
                ...request,
                sales: [...existing.filter((sale) => sale.companyId !== chosen.companyId), chosen]
            }
        }
    }
    removeSale(companyId: string) {
        if (this.selection?.kind !== 'sale') return
        const sales = this.selection.request.sales.filter((sale) => sale.companyId !== companyId)
        this.selection = sales.length
            ? { kind: 'sale', request: { ...this.selection.request, sales } }
            : undefined
    }
    moveSale(companyId: string, offset: number) {
        if (this.selection?.kind !== 'sale') return
        const sales = [...this.selection.request.sales]
        const index = sales.findIndex((sale) => sale.companyId === companyId)
        const target = index + offset
        assert(index >= 0 && target >= 0 && target < sales.length, 'Invalid sale order')
        const [sale] = sales.splice(index, 1)
        sales.splice(target, 0, sale)
        this.selection = { kind: 'sale', request: { ...this.selection.request, sales } }
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
        this.routeEditor.clear()
        this.trainDraft = undefined
        this.stationDraft = {}
        this.trackDraft = {}
        this.cancelSelection()
    }
    override async undo() {
        if (this.busy || this.isViewingHistory) return
        if (this.routeEditor.hasDraft) {
            this.routeEditor.clear()
            return
        }
        if (this.trainDraft) {
            this.trainDraft = undefined
            return
        }
        if (this.stationDraft.stationId) {
            this.stationDraft = {}
            return
        }
        if (this.trackDraft.locationId) {
            this.trackDraft = {}
            return
        }
        if (this.selection) {
            this.cancelSelection()
            return
        }
        await super.undo()
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
export function createFinanceExampleSessionClass(
    rules: StockRules,
    companyRules: CompanyRules,
    mapView: MapViewDefinition,
    trackRules: TrackRules,
    stationRules: StationRules,
    trainRules: TrainRules,
    routeRules: RouteRules
): new (options: SessionOptions) => FinanceExampleSession {
    return class extends FinanceExampleSession {
        constructor(options: SessionOptions) {
            super(
                options,
                rules,
                companyRules,
                mapView,
                trackRules,
                stationRules,
                trainRules,
                routeRules
            )
        }
    }
}
export function requireFinanceExampleSession(
    session: GameSession<GameState, HydratedGameState>
): FinanceExampleSession {
    assert(session instanceof FinanceExampleSession, 'Expected a finance example session')
    return session
}
