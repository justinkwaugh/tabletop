import {
    pendingBlockingStations,
    BuyOpeningCompany,
    PassOpeningPurchase,
    openingPurchaseChoices,
    unboughtOpeningCompanies,
    priceFor,
    canPassOpeningPurchase,
    isSettleReceiver,
    isAdvancePhase1846,
    isBuyReceiverTrain,
    isBuyReceiverShare,
    DeclareBankruptcy,
    isDeclareBankruptcy1846,
    bankruptcyShortfall,
    BuyReceiverShare,
    receiverShareChoices,
    type ReceiverShare
} from '@tabletop/1846'
import { assertExists } from '@tabletop/common'
import {
    createMapDrawing,
    stationMapTokens,
    RoutesModule,
    actionForHistoryStep,
    runForHistoryStep,
    earningsForHistoryStep,
    type RoutesSession,
    type MapSelection,
    type MapRoute
} from '@tabletop/18xx-ui'
import { MapView1846 } from './mapView.js'
import {
    getCompany,
    DiscardTrain,
    discardableTrains,
    isDiscardTrain,
    isRustTrains,
    type PurchaseAsset,
    type ShareSaleDetails,
    BuyTrain,
    OfferPurchase,
    RespondToPurchaseOffer,
    purchaseChoices,
    evaluatePurchaseOffer,
    type PurchaseOfferRequest,
    FinishOperatingTurn,
    type TrainPurchaseDetails,
    DistributeEarnings,
    type EarningsChoice,
    PlaceStation,
    type StationPlacementDetails,
    LayTile,
    FinishTrack,
    TrackConstruction,
    type TrackLayDetails,
    type TrackRequest,
    StartCompany,
    BuyShares,
    SellShares,
    FinishStockTurn
} from '@tabletop/18xx'
import { GameSession } from '@tabletop/frontend-components'
import {
    EmergencyBuyTrain,
    StartEmergencyFunding,
    SellEmergencyShares,
    emergencyFundingStart,
    emergencyFundingChoices,
    emergencyShareSaleChoices,
    isStartEmergencyFunding,
    isSellEmergencyShares,
    emergencyTrainChoices,
    isEmergencyBuyTrain,
    type EmergencyPurchase,
    TransferRules1846,
    PrivateConstruction,
    constructionPrivateIds,
    BuildPrivateTrack,
    isBuildPrivateTrack,
    chicagoPrivateStation,
    PlaceCWIStation,
    isPlaceCWIStation,
    type ConstructionPrivateId,
    AssignRevenueMarker,
    isAssignRevenueMarker,
    revenueMarkerChoices,
    revenueMarkerValue,
    type RevenuePrivateId,
    TrainRules1846,
    CorporateFinance,
    corporateFinanceChoices,
    type FinanceChoice,
    trainBuyingChoices1846,
    earningsChoices1846,
    stationChoices1846,
    AssignSteamboat,
    RouteRules1846,
    type SteamboatAssignment,
    ChooseDraftCard,
    PassFinalCompany,
    choicesFor,
    stockChoices,
    TrackRules1846,
    type EighteenFortySixProjectedState,
    type HydratedEighteenFortySixState
} from '@tabletop/1846'

export class EighteenFortySixSession extends GameSession<
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> {
    selectedAcquisition = $derived.by((): PurchaseOfferRequest | undefined => {
        void [this.gameState, this.myPlayer?.id, this.isViewingHistory, this.updatingVisibleState]
        return undefined
    })
    privateDraft = $derived.by(
        (): { privateCompanyId: ConstructionPrivateId; lays: TrackRequest[] } | undefined => {
            void [
                this.gameState,
                this.myPlayer?.id,
                this.isViewingHistory,
                this.updatingVisibleState
            ]
            return undefined
        }
    )
    private readonly interaction = $derived.by(() => {
        if (
            !this.isPlayable ||
            !this.isMyTurn ||
            this.isViewingHistory ||
            this.busy ||
            this.updatingVisibleState
        )
            return 'blocked'
        if (this.gameState.purchaseOffer) return 'purchase-response'
        if (this.gameState.pendingRevenueMarker) return 'revenue-marker'
        if (this.selectedAcquisition) return 'acquisition'
        if (this.privateDraft) return 'private-construction'
        return 'turn'
    })
    readonly canChooseAction = $derived(this.interaction === 'turn')
    readonly canUsePrivateConstruction = $derived(
        this.canChooseAction || this.interaction === 'private-construction'
    )
    readonly canOfferPurchase = $derived(
        this.canChooseAction && this.validActionTypes.includes('OfferPurchase')
    )
    readonly canRespondToPurchase = $derived(
        this.interaction === 'purchase-response' &&
            this.validActionTypes.includes('RespondToPurchaseOffer')
    )
    readonly canAssignRevenueMarker = $derived(
        (this.canChooseAction || this.interaction === 'revenue-marker') &&
            this.validActionTypes.includes('AssignRevenueMarker')
    )
    readonly constructionPrivateIds = $derived(
        this.myPlayer ? constructionPrivateIds(this.gameState, this.myPlayer.id) : []
    )
    readonly privateConstruction = $derived(
        this.myPlayer && this.privateDraft
            ? new PrivateConstruction(
                  this.gameState,
                  this.myPlayer.id,
                  this.privateDraft.privateCompanyId
              )
            : undefined
    )
    readonly privateTrackChoices = $derived(
        this.privateConstruction?.choices(this.privateDraft?.lays ?? []) ?? []
    )
    readonly privateConstructionPreview = $derived(
        this.privateDraft && !this.updatingVisibleState
            ? this.privateConstruction?.evaluate(this.privateDraft.lays, false)
            : undefined
    )
    readonly privateConstructionResult = $derived(
        this.privateDraft ? this.privateConstruction?.evaluate(this.privateDraft.lays) : undefined
    )
    readonly constructionMapState = $derived(
        this.privateConstructionPreview?.state ?? this.gameState
    )
    readonly chicagoPrivateStation = $derived(
        this.myPlayer ? chicagoPrivateStation(this.gameState, this.myPlayer.id) : undefined
    )
    readonly recordedPrivateTrack = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isBuildPrivateTrack)
            : undefined
    )
    readonly recordedPrivateStation = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isPlaceCWIStation)
                  ?.metadata
            : undefined
    )
    selectPrivateConstruction(privateCompanyId: ConstructionPrivateId): void {
        this.selectedLocation = undefined
        this.routes.clear()
        this.privateDraft = { privateCompanyId, lays: [] }
    }
    stagePrivateTrack(choice: TrackLayDetails): void {
        assertExists(this.privateDraft)
        const { companyId, locationId, definitionId, rotation, nodeMapping } = choice
        this.privateDraft = {
            ...this.privateDraft,
            lays: [
                ...this.privateDraft.lays,
                { companyId, locationId, definitionId, rotation, nodeMapping }
            ]
        }
    }
    backFromPrivateConstruction(): void {
        this.privateDraft = this.privateDraft?.lays.length
            ? { ...this.privateDraft, lays: this.privateDraft.lays.slice(0, -1) }
            : undefined
    }
    async confirmPrivateConstruction(): Promise<void> {
        assertExists(this.privateDraft)
        const lays = this.privateConstructionResult?.lays
        assertExists(lays, 'Complete a legal private construction plan')
        await this.applyAction(
            this.createPlayerAction(BuildPrivateTrack, {
                ...this.privateDraft,
                expectedCost: lays.reduce((sum, lay) => sum + lay.cost, 0)
            })
        )
    }
    async placeChicagoPrivateStation(): Promise<void> {
        assertExists(this.chicagoPrivateStation)
        await this.applyAction(
            this.createPlayerAction(PlaceCWIStation, {
                companyId: this.chicagoPrivateStation.companyId
            })
        )
    }
    readonly revenueMarkerChoices = $derived(
        this.myPlayer ? revenueMarkerChoices(this.gameState, this.myPlayer.id) : []
    )
    readonly recordedMarkerChange = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isAssignRevenueMarker)
                  ?.metadata
            : undefined
    )
    async assignRevenueMarker(
        privateCompanyId: RevenuePrivateId,
        locationId?: string
    ): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(AssignRevenueMarker, {
                privateCompanyId,
                ...(locationId ? { locationId } : {})
            })
        )
    }
    readonly acquisitionChoices = $derived(
        this.myPlayer
            ? purchaseChoices(this.gameState, this.myPlayer.id, TransferRules1846, TrainRules1846)
            : []
    )
    acquisitionPrice = $derived(this.selectedAcquisition?.price ?? 1)
    readonly acquisitionEvaluation = $derived(
        this.selectedAcquisition
            ? evaluatePurchaseOffer(
                  this.gameState,
                  { ...this.selectedAcquisition, price: this.acquisitionPrice },
                  TransferRules1846,
                  TrainRules1846
              )
            : undefined
    )
    readonly canConfirmAcquisition = $derived(
        this.interaction === 'acquisition' && !this.acquisitionEvaluation?.reason
    )
    purchaseAssetName(asset: PurchaseAsset): string {
        if (asset.kind === 'company') return getCompany(this.gameState, asset.companyId).name
        if (asset.kind === 'private') return getCompany(this.gameState, asset.privateCompanyId).name
        const train = this.gameState.trainInventory.trains.find(
            (train) => train.id === asset.trainId
        )
        assertExists(train, 'An offered train exists')
        return `${TrainRules1846.depot.trainDefinition(train.definitionId).name} train`
    }
    selectAcquisition(request: PurchaseOfferRequest): void {
        this.selectedLocation = undefined
        this.routes.clear()
        this.selectedAcquisition = request
    }
    cancelAcquisition(): void {
        this.selectedAcquisition = undefined
    }
    async confirmAcquisition(): Promise<void> {
        assertExists(this.selectedAcquisition, 'Select an asset to buy')
        await this.applyAction(
            this.createPlayerAction(OfferPurchase, {
                ...this.selectedAcquisition,
                price: this.acquisitionPrice
            })
        )
    }
    async respondToAcquisition(accept: boolean): Promise<void> {
        const offer = this.gameState.purchaseOffer
        assertExists(offer, 'A seller has an offer to answer')
        await this.applyAction(
            this.createPlayerAction(RespondToPurchaseOffer, { offerId: offer.id, accept })
        )
    }
    readonly discardChoices = $derived.by(() => {
        const companyId = this.gameState.phaseChange?.discardCompanyIds[0]
        return companyId ? discardableTrains(this.gameState, companyId, TrainRules1846) : []
    })
    async discardTrain(trainId: string): Promise<void> {
        const companyId = this.gameState.phaseChange?.discardCompanyIds[0]
        assertExists(companyId, 'A compulsory discard requires its company')
        await this.applyAction(this.createPlayerAction(DiscardTrain, { companyId, trainId }))
    }
    readonly displayedPhase = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isAdvancePhase1846)
            : undefined
    )
    readonly displayedDiscard = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isDiscardTrain)
            : undefined
    )
    readonly displayedRust = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isRustTrains)
            : undefined
    )
    readonly trainBuying = $derived(trainBuyingChoices1846(this.gameState))
    readonly displayedReceiverTrain = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isBuyReceiverTrain)
            : undefined
    )
    readonly displayedReceiverShare = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isBuyReceiverShare)
            : undefined
    )
    readonly bankruptcyShortfall = $derived(bankruptcyShortfall(this.gameState))
    readonly displayedBankruptcy = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(
                  this.actions,
                  this.gameState.actionCount,
                  isDeclareBankruptcy1846
              )
            : undefined
    )
    readonly receiverShares = $derived(
        this.myPlayer ? receiverShareChoices(this.gameState, this.myPlayer.id) : []
    )
    async buyReceiverShare(choice: ReceiverShare): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(BuyReceiverShare, {
                companyId: choice.companyId,
                expectedPrice: choice.price
            })
        )
    }
    async declareBankruptcy(): Promise<void> {
        assertExists(this.gameState.emergencyFunding, 'Bankruptcy requires emergency funding')
        await this.applyAction(
            this.createPlayerAction(DeclareBankruptcy, {
                companyId: this.gameState.emergencyFunding.companyId
            })
        )
    }
    readonly fundingStart = $derived(emergencyFundingStart(this.gameState))
    readonly fundingChoices = $derived(emergencyFundingChoices(this.gameState))
    readonly emergencySales = $derived(emergencyShareSaleChoices(this.gameState))
    readonly displayedFundingStart = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(
                  this.actions,
                  this.gameState.actionCount,
                  isStartEmergencyFunding
              )
            : undefined
    )
    readonly displayedEmergencySale = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isSellEmergencyShares)
            : undefined
    )
    async startEmergencyFunding(): Promise<void> {
        assertExists(this.fundingStart, 'Emergency funding requires a shortfall')
        await this.applyAction(
            this.createPlayerAction(StartEmergencyFunding, {
                companyId: this.fundingStart.companyId
            })
        )
    }
    async sellEmergencyShares(choice: ShareSaleDetails): Promise<void> {
        const sale = choice.sales[0]
        await this.applyAction(
            this.createPlayerAction(SellEmergencyShares, {
                companyId: sale.companyId,
                shares: sale.shares,
                expectedProceeds: choice.proceeds
            })
        )
    }
    readonly emergencyTrainChoices = $derived(emergencyTrainChoices(this.gameState))
    readonly displayedEmergencyPurchase = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isEmergencyBuyTrain)
            : undefined
    )
    async emergencyBuyTrain(choice: EmergencyPurchase): Promise<void> {
        await this.applyAction(this.createPlayerAction(EmergencyBuyTrain, choice))
    }
    async buyTrain(choice: TrainPurchaseDetails): Promise<void> {
        const { price, ...request } = choice
        await this.applyAction(
            this.createPlayerAction(BuyTrain, { ...request, expectedPrice: price })
        )
    }
    async finishOperatingTurn(): Promise<void> {
        const companyId = this.gameState.trainPurchaseStep?.companyId
        assertExists(companyId, 'Finishing a turn requires its train purchase step')
        await this.applyAction(this.createPlayerAction(FinishOperatingTurn, { companyId }))
    }
    readonly earningsChoices = $derived(
        this.gameState.machineState === 'DistributingEarnings'
            ? earningsChoices1846(this.gameState)
            : []
    )
    async distributeEarnings(choice: EarningsChoice): Promise<void> {
        const companyId = this.gameState.routeStep?.companyId
        assertExists(companyId, 'Earnings require a completed run')
        await this.applyAction(this.createPlayerAction(DistributeEarnings, { companyId, choice }))
    }
    readonly financeChoices = $derived(corporateFinanceChoices(this.gameState))
    async corporateFinance(choice: FinanceChoice): Promise<void> {
        await this.applyAction(this.createPlayerAction(CorporateFinance, choice))
    }
    readonly stationChoices = $derived(
        this.gameState.machineState === 'LayingTrack' && !this.updatingVisibleState
            ? stationChoices1846(this.gameState)
            : []
    )
    async placeStation(choice: StationPlacementDetails): Promise<void> {
        const { cost, ...request } = choice
        await this.applyAction(
            this.createPlayerAction(PlaceStation, { ...request, expectedCost: cost })
        )
    }
    private openedPacketKey = $state<string>()
    private readonly packetKey = $derived(
        `${this.gameState.id}:${this.gameState.actionCount}:${this.myPlayer?.id}`
    )
    readonly packetVisible = $derived(
        !this.updatingVisibleState && this.openedPacketKey === this.packetKey
    )
    readonly draftChoices = $derived(
        this.myPlayer ? choicesFor(this.gameState, this.myPlayer.id) : []
    )
    readonly openingChoices = $derived(
        this.myPlayer ? openingPurchaseChoices(this.gameState, this.myPlayer.id) : []
    )
    readonly openingCompanies = $derived(
        this.gameState.draft.kind === 'public' && this.gameState.draft.stage === 'buying'
            ? unboughtOpeningCompanies(this.gameState).map((companyId) => ({
                  companyId,
                  expectedPrice: priceFor(this.gameState, companyId)
              }))
            : []
    )
    readonly canPassOpening = $derived(
        this.canChooseAction &&
            !!this.myPlayer &&
            canPassOpeningPurchase(this.gameState, this.myPlayer.id)
    )
    readonly stockChoices = $derived(
        this.gameState.machineState === 'StockRound' && this.myPlayer
            ? stockChoices(this.gameState, this.myPlayer.id)
            : undefined
    )
    private readonly mapRevenueMarkers = $derived([
        ...this.gameState.revenueMarkers,
        ...(this.gameState.steamboat
            ? [{ ...this.gameState.steamboat, privateCompanyId: 'SC' as const }]
            : [])
    ])
    readonly pendingBlockers = $derived(pendingBlockingStations(this.constructionMapState))
    readonly mapScene = $derived(
        createMapDrawing(
            MapView1846.map,
            {
                tileSet: MapView1846.tileSet,
                inventory: this.constructionMapState.tileInventory,
                markers: [
                    ...this.mapRevenueMarkers.map((marker) => ({
                        locationId: marker.locationId,
                        privateCompanyId: marker.privateCompanyId,
                        kind: `${marker.companyId}:${marker.privateCompanyId}`
                    })),
                    ...this.pendingBlockers.map((station) => ({
                        locationId: station.locationId,
                        kind: station.stationId
                    }))
                ]
            },
            {
                ...MapView1846,
                locationMarkerNames: Object.fromEntries([
                    ...this.mapRevenueMarkers.map((marker) => [
                        `${marker.companyId}:${marker.privateCompanyId}`,
                        `${marker.companyId} ${marker.privateCompanyId} +$${revenueMarkerValue(marker.privateCompanyId, marker.locationId)}`
                    ]),
                    ...this.pendingBlockers.map((station) => [
                        station.stationId,
                        `${station.companyId} blocks on green`
                    ])
                ])
            }
        )
    )
    readonly canRun = $derived(
        this.canChooseAction &&
            ['RunningTrains', 'RunningReceiver'].includes(this.gameState.machineState)
    )
    private readonly routeSession: RoutesSession<HydratedEighteenFortySixState> = ((session) => ({
        get state() {
            void [session.myPlayer?.id, session.isViewingHistory, session.updatingVisibleState]
            return session.gameState
        },
        rules: { routeRules: RouteRules1846 },
        get validActionTypes() {
            return session.validActionTypes
        },
        get publishing() {
            return session.updatingVisibleState
        },
        get selectionsVisible() {
            return session.canRun
        },
        get interactive() {
            return session.canRun
        },
        createPlayerAction: (schema, data) => session.createPlayerAction(schema, data),
        applyAction: (action) => session.applyAction(action)
    }))(this)
    readonly routes = new RoutesModule(
        this.routeSession,
        () => {},
        () => []
    )
    readonly earningsResult = $derived(
        !this.updatingVisibleState
            ? (actionForHistoryStep(this.actions, this.gameState.actionCount, isSettleReceiver)
                  ?.metadata ??
                  earningsForHistoryStep(this.actions, this.gameState.actionCount) ??
                  this.gameState.earningsDistribution)
            : undefined
    )
    readonly recordedRun = $derived(
        !this.updatingVisibleState
            ? runForHistoryStep(this.actions, this.gameState.actionCount)
            : undefined
    )
    readonly routeOverlays: readonly MapRoute[] = $derived(
        this.recordedRun
            ? this.recordedRun.routes.map((route) => ({
                  id: route.trainId,
                  color: '#267343',
                  segments: route.paths
              }))
            : this.routes.overlays
    )
    readonly presentation = { money: (amount: number) => `$${amount}` }
    async assignSteamboat(assignment?: SteamboatAssignment): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(AssignSteamboat, assignment ? { assignment } : {})
        )
    }
    readonly mapTokens = $derived(stationMapTokens(this.constructionMapState, MapView1846.stations))
    readonly canSelectTrack = $derived(
        this.canChooseAction && this.gameState.machineState === 'LayingTrack'
    )
    readonly construction = $derived(
        this.gameState.machineState === 'LayingTrack'
            ? new TrackConstruction(this.gameState, TrackRules1846)
            : undefined
    )
    readonly trackLocations = $derived(
        this.canSelectTrack && this.construction
            ? MapView1846.map.definition.locations
                  .filter((location) => this.construction!.choices(location.id).length)
                  .map((location) => location.id)
            : []
    )
    selectedLocation = $derived.by((): string | undefined => {
        void [
            this.gameState.id,
            this.gameState.actionCount,
            this.myPlayer?.id,
            this.updatingVisibleState,
            this.canSelectTrack
        ]
        return undefined
    })
    readonly selectedTrackChoices = $derived(
        this.selectedLocation && !this.updatingVisibleState
            ? (this.construction?.choices(this.selectedLocation) ?? [])
            : []
    )
    selectMap(selection: MapSelection): void {
        if (!this.canSelectTrack) return
        this.selectedLocation = selection.locationId || undefined
    }
    backFromTrack(): void {
        this.selectedLocation = undefined
    }
    async layTrack(choice: TrackLayDetails): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(LayTile, {
                companyId: choice.companyId,
                locationId: choice.locationId,
                definitionId: choice.definitionId,
                rotation: choice.rotation,
                nodeMapping: choice.nodeMapping,
                expectedCost: choice.cost
            })
        )
    }
    async finishTrack(): Promise<void> {
        const companyId = this.gameState.trackStep?.companyId
        assertExists(companyId, 'Track construction requires an operating company')
        await this.applyAction(this.createPlayerAction(FinishTrack, { companyId }))
    }
    override async undo(): Promise<void> {
        if (this.privateDraft) {
            this.privateDraft = undefined
            return
        }
        if (this.selectedAcquisition) {
            this.cancelAcquisition()
            return
        }
        if (this.canRun && this.routes.hasManual()) {
            this.routes.clear()
            return
        }
        if (this.selectedLocation !== undefined) {
            this.selectedLocation = undefined
            return
        }
        await super.undo()
    }
    async startCompany(
        choice: NonNullable<typeof this.stockChoices>['starts'][number]
    ): Promise<void> {
        await this.applyAction(this.createPlayerAction(StartCompany, choice))
    }
    async buyShare(choice: NonNullable<typeof this.stockChoices>['buys'][number]): Promise<void> {
        const { companyId: _companyId, source: _source, ...request } = choice
        await this.applyAction(this.createPlayerAction(BuyShares, request))
    }
    async sellShares(
        choice: NonNullable<typeof this.stockChoices>['sells'][number]
    ): Promise<void> {
        await this.applyAction(this.createPlayerAction(SellShares, choice))
    }
    async finishStockTurn(): Promise<void> {
        await this.applyAction(this.createPlayerAction(FinishStockTurn))
    }
    revealPacket(): void {
        this.openedPacketKey = this.packetKey
    }
    hidePacket(): void {
        this.openedPacketKey = undefined
    }
    async choose(cardId: string): Promise<void> {
        this.hidePacket()
        await this.applyAction(this.createPlayerAction(ChooseDraftCard, { cardId }))
    }
    async buyOpeningCompany(choice: (typeof this.openingChoices)[number]): Promise<void> {
        await this.applyAction(this.createPlayerAction(BuyOpeningCompany, choice))
    }
    async passOpeningPurchase(): Promise<void> {
        await this.applyAction(this.createPlayerAction(PassOpeningPurchase))
    }
    async passFinalCompany(): Promise<void> {
        this.hidePacket()
        await this.applyAction(this.createPlayerAction(PassFinalCompany))
    }
    override beforeNewState(): void {
        this.cancelAcquisition()
        this.routes.clear()
        this.hidePacket()
        this.selectedLocation = undefined
    }
}
