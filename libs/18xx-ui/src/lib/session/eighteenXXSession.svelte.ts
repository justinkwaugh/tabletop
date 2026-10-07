import type { EighteenXXRuntimeSchema, TitleStateSchema } from '@tabletop/18xx'
import { operatingStepIndex } from '../table/operatingStep.js'
import {
    cashOwnedBy,
    EighteenXXPreferenceDefinition,
    getCompany,
    isPrivateExchangeAction,
    isPrivateTileLay,
    priorityOrder,
    shareSaleValue,
    stockCertificateCount,
    stockMarketOrder,
    titleComponents,
    trainsOwnedBy,
    type EighteenXXPreferences,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type HydratedEighteenXXState,
    type Owner,
    type Portfolio,
    type TileRotation
} from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import { assert, assertExists, GameStorage } from '@tabletop/common'
import type { TitlePreferences } from '@tabletop/frontend-components'
import { GameSession, type GameSessionView } from '@tabletop/frontend-components'
import {
    HistoricalMaps,
    type HistoricalMapState,
    type HistoricalMap
} from '../maps/historicalMap.js'
import {
    type MapViewDefinition,
    type StationAppearance,
    type TokenTiles
} from '../maps/stationPresentation.js'
import { createTileDrawing } from '../tiles/tileDrawing.js'
import { terrainIconAppearance } from '../maps/terrainIcons.js'
import { createMarketAnimationSource } from '../stock/marketAnimationSource.js'
import { companySharePrice } from '../table/companyPresentation.js'
import { shouldContinueHistoryStep } from '../table/historyNavigation.js'
import { operatingHistory } from '../table/operatingHistory.js'
import { shareCard, tradedCertificateIds, type ShareCard } from '../table/shareCards.js'
import { tileDrawingStyle, type TileAppearance } from '../tiles/tileAppearance.js'
import { tileSymbolAppearance } from '../tiles/tileSymbols.js'
import { CashCrisisModule } from './cashCrisisModule.svelte.js'
import { CompanyAuctionModule } from './companyAuctionModule.svelte.js'
import { CompanyDecisionsModule } from './companyDecisionsModule.svelte.js'
import { DiscardModule } from './discardModule.svelte.js'
import { EarningsModule } from './earningsModule.svelte.js'
import { LoanModule } from './loanModule.svelte.js'
import { LocalSelections } from './localSelections.js'
import { MapModule, MapStyleAppearances } from './mapModule.svelte.js'
import type { ModuleSession } from './moduleSession.js'
import { OfferAuctionModule } from './offerAuctionModule.svelte.js'
import { OperatingTurnModule } from './operatingTurnModule.svelte.js'
import {
    PrivateActionsModule,
    type PrivateTrackPower,
    type TitlePrivatePower
} from './privateActionsModule.svelte.js'
import { PrivatesModule } from './privatesModule.svelte.js'
import { RoutesModule } from './routesModule.svelte.js'
import { SelectionAuctionModule } from './selectionAuctionModule.svelte.js'
import { StationsModule } from './stationsModule.svelte.js'
import { StockInstructionModule } from './stockInstructionModule.svelte.js'
import { StockModule } from './stockModule.svelte.js'
import { TableNotices } from './tableNotices.svelte.js'
import type { PrivateTokenPresentation, TitlePresentation } from './titlePresentation.js'
import { TrackModule } from './trackModule.svelte.js'
import { TrainBuyingModule } from './trainBuyingModule.svelte.js'
import { TrainFundingModule } from './trainFundingModule.svelte.js'
import { WaterfallAuctionModule } from './waterfallAuctionModule.svelte.js'

export type EighteenXXSessionRules<
    Schema extends TitleStateSchema = EighteenXXRuntimeSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState =
        HydratedEighteenXXState<Schema> & HydratedEighteenXXState
> = Omit<
    EighteenXXTitleRules<Schema, State>,
    | 'createOpening'
    | 'decisionHandlers'
    | 'titleStateHandlers'
    | 'titleActions'
    | 'trainFundingRules'
> &
    Partial<Pick<EighteenXXTitleRules<Schema, State>, 'trainFundingRules'>>

type SessionOptions<
    Schema extends TitleStateSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState
> = ConstructorParameters<typeof GameSession<EighteenXXState<Schema>, State>>[0]
export class EighteenXXSession<
    Schema extends TitleStateSchema = EighteenXXRuntimeSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState =
        HydratedEighteenXXState<Schema> & HydratedEighteenXXState
> extends GameSession<EighteenXXState<Schema>, State> {
    privateCompanyTokens: Readonly<Record<string, StationAppearance>> = $derived.by(() =>
        Object.fromEntries(
            Object.entries(this.presentationDefinition.privateTokens ?? {}).map(
                ([privateCompanyId, token]) => [
                    privateCompanyId,
                    this.privateTokenAppearance(privateCompanyId, token)
                ]
            )
        )
    )
    private privateTokenAppearance(
        privateCompanyId: string,
        token: PrivateTokenPresentation
    ): StationAppearance {
        if ('companyId' in token) return this.mapView.stations[token.companyId]
        if ('tileSymbol' in token)
            return tileSymbolAppearance(token.tileSymbol, this.tileAppearance)
        if ('terrain' in token) return terrainIconAppearance(token.terrain)
        if ('imageUrl' in token)
            return { label: privateCompanyId, color: 'transparent', imageUrl: token.imageUrl }
        return {
            label: privateCompanyId,
            color: 'transparent',
            tiles: this.tokenTiles(token.tiles)
        }
    }
    private tokenTiles(
        tiles: readonly { definitionId: string; rotation: TileRotation }[]
    ): TokenTiles {
        const orientation = this.mapView.map.definition.orientation
        return {
            orientation,
            appearance: this.tileAppearance,
            tiles: tiles.map(({ definitionId, rotation }) => {
                const definition = this.mapView.tileSet.definitions.find(
                    (tile) => tile.id === definitionId
                )
                assertExists(definition, `Unknown private token tile ${definitionId}`)
                return {
                    face: definition.face,
                    drawing: createTileDrawing(
                        definition.face,
                        orientation,
                        rotation,
                        this.mapView.layouts?.[definitionId],
                        tileDrawingStyle(this.tileAppearance)
                    )
                }
            })
        }
    }
    operatingIncomeHistory() {
        return operatingHistory(this.history.visibleContext.actions)
    }
    readonly marketAnimation = createMarketAnimationSource(this, (state) => state.stockMarket)
    readonly preferences: TitlePreferences<typeof EighteenXXPreferences> = this.createPreferences(
        EighteenXXPreferenceDefinition
    )
    protected readonly localSelections = new LocalSelections()
    private get localHotseat() {
        return !!this.game.hotseat && this.game.storage === GameStorage.Local
    }
    private readonly moduleSession: ModuleSession<
        HydratedEighteenXXState,
        Omit<EighteenXXSessionRules, 'state'>
    > = ((session: EighteenXXSession<Schema, State>) => ({
        get state() {
            return session.gameState
        },
        get rules() {
            return session.rules
        },
        get validActionTypes() {
            return session.validActionTypes
        },
        get publishing() {
            return session.updatingVisibleState
        },
        get viewingHistory() {
            return session.isViewingHistory
        },
        get selectionsVisible() {
            return (
                !session.updatingVisibleState &&
                !session.isViewingHistory &&
                !session.sharedActionsBlocked
            )
        },
        get interactive() {
            return (
                !session.busy &&
                !session.updatingVisibleState &&
                !session.isViewingHistory &&
                !session.sharedActionsBlocked
            )
        },
        get ordinaryHotseatPlay() {
            return session.localHotseat && !session.isDeveloperHarness
        },
        get viewingAsNonActivePlayer() {
            return session.isViewingAsNonActivePlayer
        },
        get playerId() {
            return session.myPlayer?.id
        },
        get actingPlayerIds() {
            return session.localHotseat
                ? session.gameState.activePlayerIds
                : session.myPlayer
                  ? [session.myPlayer.id]
                  : []
        },
        canActFor: (playerId) => session.localHotseat || session.myPlayer?.id === playerId,
        get recordedActions() {
            return session.actions.slice(0, session.gameState.actionCount)
        },
        settled: () => session.waitForVisibleTransitionSettled(),
        withSupersededAction: (action) => session.withSupersededAction(action),
        createPlayerAction: (schema, data) => session.createPlayerAction(schema, data),
        applyAction: (action) => session.applyAction(action)
    }))(this)
    readonly offers = new OfferAuctionModule(this.moduleSession)
    readonly waterfall = new WaterfallAuctionModule(this.moduleSession)
    readonly selectionAuction = new SelectionAuctionModule(this.moduleSession)
    readonly companyAuction = new CompanyAuctionModule(this.moduleSession)
    readonly privates = new PrivatesModule(this.moduleSession)
    readonly notices = new TableNotices(
        () => this.isViewingHistory || this.localHotseat,
        () => this.myPlayer?.id,
        (action) => this.noticeText(action)
    )
    readonly trainFunding = new TrainFundingModule(this.moduleSession)
    readonly decisions = new CompanyDecisionsModule(this.moduleSession)
    readonly privateActions: PrivateActionsModule = new PrivateActionsModule(
        this.moduleSession,
        this.decisions,
        {
            undo: (): boolean => this.track.stages.undo(),
            clear: () => this.track.stages.clear()
        },
        this.privates,
        () => this.titlePrivatePowers,
        () => this.offeredPrivatePower
    )
    readonly track: TrackModule = new TrackModule(
        this.moduleSession,
        () => this.mapView,
        this.privateActions,
        this.decisions,
        () => {
            this.map.clearInspection()
        },
        () => this.trackBuildingActive
    )
    readonly trainBuying = new TrainBuyingModule(
        this.moduleSession,
        () => this.decisions.purchaseOptions
    )
    get requiresStationTokenChoice(): boolean {
        return false
    }
    readonly stations = new StationsModule(
        this.moduleSession,
        () => {
            this.map.clearInspection()
        },
        () => this.requiresStationTokenChoice,
        () => this.stationPlacementActive
    )
    readonly routes = new RoutesModule(
        this.moduleSession,
        (selection) => {
            this.map.inspect(selection)
        },
        () => this.map.networkRoutes
    )
    readonly map: MapModule = new MapModule(
        this.moduleSession,
        () => this.mapView,
        this.track,
        this.stations,
        this.routes,
        this.companyAuction,
        () => this.mapDisplayState
    )
    readonly operating = new OperatingTurnModule(
        this.moduleSession,
        {
            finishTrack: () => this.track.finish(),
            finishStations: () => this.stations.finish(),
            trainSelected: () => !!this.trainBuying.depotSelection,
            hasLocalSelection: () => this.hasLocalSelection
        },
        () => this.operatingStepCompletion,
        (state) => {
            const steps = this.presentation.operatingSteps
            if (!steps) return operatingStepIndex(state)
            const index = steps.findIndex((step) => step.states.includes(state))
            return index < 0 ? undefined : index
        }
    )
    readonly stock = new StockModule(
        this.moduleSession,
        () => {
            this.companyAuction.clearOpening()
            this.onStockSelectionCancelled()
        },
        () => this.privates.exchangeOffers.length > 0,
        () => this.additionalStockMenuCount
    )
    get additionalStockMenuCount() {
        return 0
    }
    readonly instructions = new StockInstructionModule(this.moduleSession)
    readonly earnings = new EarningsModule(this.moduleSession)
    readonly discard = new DiscardModule(this.moduleSession)
    readonly loans = new LoanModule(this.moduleSession)
    readonly cashCrisis = new CashCrisisModule(this.moduleSession)
    /**
     * Whether this player is viewing the title's published artwork (board image and token art)
     * instead of the generic presentation. A display choice only: it never changes Game State.
     */
    publishedArtwork = $state(false)
    get publishedArtworkAvailable(): boolean {
        return (
            !!this.mapViewDefinition.boardArtwork ||
            !!this.mapViewDefinition.publishedStations ||
            !!this.presentationDefinition.publishedCardImages ||
            !!this.presentationDefinition.publishedTrainColors
        )
    }
    toggleArtwork() {
        this.publishedArtwork = !this.publishedArtwork
    }
    /** Published certificate art for the shares a purchase, sale or issue moved; empty unless that presentation is on. */
    shareCards(action: GameAction): readonly ShareCard[] {
        if (!this.publishedArtwork) return []
        const shares = (id: string) => {
            const certificate = this.gameState.certificates.find((item) => item.id === id)
            return certificate?.kind === 'share' ? certificate.shares : 1
        }
        return tradedCertificateIds(action, shares).flatMap((id) => {
            const certificate = this.gameState.certificates.find((item) => item.id === id)
            const card =
                certificate &&
                shareCard(
                    certificate,
                    this.presentation,
                    (companyId) =>
                        this.gameState.companies.find((company) => company.id === companyId)
                            ?.name ?? companyId
                )
            return card ? [card] : []
        })
    }
    /** Published train card art for a train definition, when that presentation is on. */
    publishedTrainImage(definitionId: string): string | undefined {
        if (!this.publishedArtwork) return undefined
        return this.presentation.publishedTrainImages?.[definitionId]
    }
    /** Published card image for a private company or certificate id, when that presentation is on. */
    publishedCardImage(
        id: string | undefined,
        size: 'full' | 'thumbnail' = 'full'
    ): string | undefined {
        if (!this.publishedArtwork || id === undefined) return undefined
        const full = this.presentation.publishedCardImages?.[id]
        return (size === 'thumbnail' && this.presentation.publishedCardThumbnails?.[id]) || full
    }
    /** Tile rendering style for the current presentation, used by every tile drawn in the table. */
    readonly tileAppearance: TileAppearance = $derived.by(() => {
        const published = this.publishedArtwork
            ? this.mapViewDefinition.publishedTileAppearance
            : undefined
        return published ?? MapStyleAppearances[this.map.style]
    })
    /** The map view for the current presentation: published token art replaces the generic set when selected. */
    readonly mapView: MapViewDefinition = $derived.by(() => {
        const base = this.mapViewDefinition
        const overrides = this.stationAppearanceOverrides
        const definition = overrides
            ? { ...base, stations: { ...base.stations, ...overrides } }
            : base
        const styled = { ...definition, drawingStyle: tileDrawingStyle(this.tileAppearance) }
        if (!this.publishedArtwork) return styled
        if (
            !definition.publishedStations &&
            !definition.publishedLayouts &&
            !definition.publishedPlacements
        )
            return styled
        return {
            ...styled,
            stations: { ...definition.stations, ...definition.publishedStations, ...overrides },
            layouts: { ...definition.layouts, ...definition.publishedLayouts },
            placements: { ...definition.placements, ...definition.publishedPlacements }
        }
    })
    /** The title presentation for the current mode: published badge colours replace the generic ones when selected. */
    readonly presentation: TitlePresentation<EighteenXXState<Schema>> = $derived.by(() => {
        const definition = this.presentationDefinition
        const trains = definition.publishedTrainColors
        if (!this.publishedArtwork || !trains) return definition
        return {
            ...definition,
            trainColors: { ...definition.trainColors, ...trains },
            phaseColors: {
                ...definition.phaseColors,
                ...(definition.publishedPhaseColors ?? trains)
            }
        }
    })
    constructor(
        options: SessionOptions<Schema, State>,
        private readonly rules: EighteenXXSessionRules<Schema, State>,
        private readonly mapViewDefinition: MapViewDefinition,
        private readonly presentationDefinition: TitlePresentation<EighteenXXState<Schema>>
    ) {
        super(options)
        const { map, tileSet } = titleComponents(rules)
        assert(
            mapViewDefinition.map === map && mapViewDefinition.tileSet === tileSet,
            'The map view must present the title’s map and tile set'
        )
        this.historicalMaps = new HistoricalMaps(
            () => this.mapView,
            (state) =>
                this.projectMapState(
                    this.rules.state.hydrate(
                        state,
                        this.rules.trackRules.map,
                        this.rules.trackRules.tileSet,
                        this.rules.trainRules.depot
                    )
                )
        )
        this.registerLocalSelections()
        this.addGameStateChangeListener(async ({ action }) => this.notices.observe(action))
    }
    private noticeText(action: GameAction): string | undefined {
        if (isPrivateTileLay(action)) {
            const location = this.mapView.map.definition.locations.find(
                (item) => item.id === action.locationId
            )
            return `${this.getPlayerName(action.playerId)} used ${getCompany(this.gameState, action.privateCompanyId).name} at ${location?.name ?? action.locationId}`
        }
        if (!isPrivateExchangeAction(action)) return undefined
        const company = this.privates.exchangeCompany(action.certificateId)
        const article = /^[AEIOU]/i.test(company.name) ? 'an' : 'a'
        return `${this.getPlayerName(action.playerId)} exchanged ${getCompany(this.gameState, action.privateCompanyId).name} for ${article} ${company.name} share`
    }
    auctionLotsFor(state: EighteenXXState) {
        return (
            this.rules.offerAuctionRules?.lots(state) ??
            this.rules.auctionRules?.lots(state) ??
            this.rules.selectionAuctionRules?.lots(state) ??
            []
        )
    }
    protected override getActivePlayers() {
        return this.gameState.activePlayerIds.flatMap((id) =>
            this.game.players.filter((player) => player.id === id)
        )
    }
    protected get operatingStepCompletion() {
        if (this.presentation.operatingSteps) return undefined
        return OperatingTurnModule.defaultCompletion(this.moduleSession, {
            finishTrack: () => this.track.finish(),
            finishStations: () => this.stations.finish()
        })
    }
    protected onStockSelectionCancelled() {}
    protected get trackBuildingActive(): boolean {
        return true
    }
    protected get stationPlacementActive(): boolean {
        return this.gameState.machineState === 'PlacingStation'
    }
    protected get sharedActionsBlocked(): boolean {
        return false
    }
    /** Private powers whose rules the title applies itself, offered under Use privates. */
    protected get titlePrivatePowers(): readonly TitlePrivatePower[] {
        return []
    }
    /**
     * Station looks that depend on the game, such as removed companies' blocked homes. Keep the
     * result's identity stable between states, since the whole map view follows it.
     */
    protected get stationAppearanceOverrides():
        Readonly<Record<string, StationAppearance>> | undefined {
        return undefined
    }
    /** A power to open without being asked, such as one the operating company just bought. */
    protected get offeredPrivatePower(): PrivateTrackPower | undefined {
        return undefined
    }
    /** Hexes a title currently offers on the map and what choosing one does, such as a private's port. */
    get mapLocationChoice(): MapLocationChoice | undefined {
        const power = this.privateActions.titlePower
        if (!power || !this.decisions.canResolve) return undefined
        if (power.kind === 'location')
            return {
                locationIds: power.locationIds,
                choose: (locationId, nodeId) => void power.choose(locationId, nodeId)
            }
        // A confirm power's previewed stations can be chosen on the map as well.
        if (power.kind === 'confirm' && power.reservations?.length)
            return {
                locationIds: [
                    ...new Set(power.reservations.map((reservation) => reservation.locationId))
                ],
                choose: () => void power.run()
            }
        return undefined
    }
    protected get mapDisplayState(): ConstructorParameters<typeof MapModule>[0]['state'] {
        return this.projectMapState(this.gameState)
    }
    protected projectMapState(state: State): HistoricalMapState {
        return state
    }

    availableTrainDefinitionIds = $derived.by(() =>
        this.rules.trainRules.availableDefinitions(this.gameState)
    )
    trainRosters = $derived.by(() =>
        this.gameState.companies
            .map((company) => ({
                company,
                trains: trainsOwnedBy(this.gameState, {
                    kind: 'company',
                    companyId: company.id
                })
            }))
            .filter((entry) => entry.trains.length)
    )
    playerPriorityOrder = $derived.by(() =>
        this.gameState.machineState === 'StockRound'
            ? priorityOrder(this.gameState, this.rules.stockRules.round)
            : this.gameState.turnManager.turnOrder
    )
    companySoldOut(companyId: string): boolean {
        return (
            companySharePrice(this.gameState.stockMarket, companyId) !== undefined &&
            this.rules.stockRules.round.soldOut(this.gameState, companyId)
        )
    }
    playerLiquidity(playerId: string): number {
        const owner = { kind: 'player', playerId } as const
        const cash = cashOwnedBy(this.gameState, owner)
        assert(typeof cash === 'number', 'Player liquidity requires finite cash')
        const auction = this.waterfall.model
        const uncommittedCash =
            auction && !auction.auction.completed ? auction.availableCash(playerId) : cash
        return uncommittedCash + shareSaleValue(this.gameState, owner, this.rules.stockRules)
    }
    companyRequiresTrain(companyId: string): boolean {
        return (
            !getCompany(this.gameState, companyId).closed &&
            this.rules.trainRules.requiresTrain(this.gameState, companyId)
        )
    }
    get trainDepot() {
        return this.rules.trainRules.depot
    }
    trainShortLabel(definitionId: string): string {
        return (
            this.presentation.trainShortLabels?.[definitionId] ??
            this.trainDepot.trainDefinition(definitionId).name
        )
    }
    get phases() {
        return this.rules.phases
    }
    get operatingRules() {
        return this.rules.operatingRules
    }
    get valuationRules() {
        return this.rules.endingRules
    }
    override shouldAutoStepAction(action: GameAction, next?: GameAction) {
        return shouldContinueHistoryStep(action, next)
    }
    get passing() {
        return this.rules.stockRules.round.passing
    }
    private readonly historicalMaps: HistoricalMaps<EighteenXXState<Schema>>
    // A new object whenever the visible state changes or starts/stops updating. A preview map is
    // only shown for the visible state it was opened on.
    private visibleStateKey = $derived({
        state: this.gameState,
        updating: this.updatingVisibleState
    })
    private historicalMapPreview = $state.raw<{ visibleState: object; map: HistoricalMap }>()
    historicalMap: HistoricalMap | undefined = $derived(
        this.historicalMapPreview?.visibleState === this.visibleStateKey
            ? this.historicalMapPreview.map
            : undefined
    )
    previewHistoryMap(action: GameAction) {
        if (this.busy || this.updatingVisibleState) return
        if (this.historicalMap?.actionId === action.id) {
            this.historicalMapPreview = undefined
            return
        }
        const context = this.history.visibleContext
        this.historicalMapPreview = {
            visibleState: this.visibleStateKey,
            map: this.historicalMaps.preview(context.state, context.actions, action)
        }
    }
    closeHistoricalMap() {
        this.historicalMapPreview = undefined
    }
    sharesToFloat(companyId: string) {
        return this.rules.companyRules.sharesToFloat?.(this.gameState, companyId)
    }
    stockCompanyName(companyId: string) {
        return getCompany(this.gameState, companyId).name
    }
    get stockCompanies() {
        const order = stockMarketOrder(this.gameState.stockMarket)
        const rank = new Map(order.map((id, index) => [id, index]))
        return this.gameState.companies
            .filter((company) => company.started)
            .sort(
                (left, right) =>
                    (rank.get(left.id) ?? order.length) - (rank.get(right.id) ?? order.length)
            )
    }
    certificateWeight = (certificate: Portfolio[number]) =>
        this.rules.stockRules.certificateWeight(this.gameState, certificate)
    playerCertificates(playerId: string) {
        const owner = { kind: 'player', playerId } as const
        return {
            count: stockCertificateCount(this.gameState, owner, this.rules.stockRules),
            limit: this.rules.stockRules.certificateLimit(this.gameState, owner)
        }
    }
    ownerName(owner: Owner): string {
        if (owner.kind === 'player') return this.getPlayerName(owner.playerId)
        return owner.kind === 'bank'
            ? this.gameState.bank.name
            : getCompany(this.gameState, owner.companyId).name
    }
    override beforeNewState() {
        this.map.clearInspection()
        this.localSelections.clear()
    }
    get hasLocalSelection(): boolean {
        return this.localSelections.hasManual()
    }
    override async undo() {
        if (this.busy || this.isViewingHistory) return
        if (this.localSelections.undo()) return
        this.stock.menu.clear()
        await super.undo()
    }
    private registerLocalSelections() {
        const { localSelections } = this
        localSelections.register(this.trainBuying.sourceStages)
        localSelections.register(this.offers.choice)
        localSelections.register(this.waterfall.choice)
        localSelections.register(this.selectionAuction.choice)
        localSelections.register(this.companyAuction)
        localSelections.register(this.decisions.choice)
        localSelections.register(this.privateActions)
        localSelections.register(this.privates.exchangeChoice)
        localSelections.register(this.discard.choice)
        localSelections.register(this.earnings.choice)
        localSelections.register(this.routes)
        localSelections.register(this.trainBuying.depotChoice)
        localSelections.register(this.stations.stages)
        localSelections.register(this.track.stages)
        localSelections.register(this.stock)
        localSelections.register(this.cashCrisis.bankruptcy)
    }
}
export function createEighteenXXSessionClass<
    Schema extends TitleStateSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState
>(
    rules: EighteenXXSessionRules<Schema, State>,
    mapView: MapViewDefinition,
    presentation: TitlePresentation<EighteenXXState<Schema>>
): new (options: SessionOptions<Schema, State>) => EighteenXXSession<Schema, State> {
    return class extends EighteenXXSession<Schema, State> {
        constructor(options: SessionOptions<Schema, State>) {
            super(options, rules, mapView, presentation)
        }
    }
}
export function requireEighteenXXSession(
    session: GameSessionView<EighteenXXState, HydratedEighteenXXState>
): EighteenXXSessionView {
    assert(session instanceof EighteenXXSession, 'Expected an 18xx session')
    return session
}

export type MapLocationChoice = {
    locationIds: readonly string[]
    /** Chooses a hex, with the city or town clicked within it when there was one. */
    choose(locationId: string, nodeId?: string): void
}

export type EighteenXXSessionView = GameSessionView<EighteenXXState, HydratedEighteenXXState> &
    Omit<EighteenXXSession, keyof GameSession<EighteenXXState, HydratedEighteenXXState>>
