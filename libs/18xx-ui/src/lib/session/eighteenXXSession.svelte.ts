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
    sharesOwned,
    stockCertificateCount,
    titleComponents,
    TileUpgrades,
    trainsOwnedBy,
    type AuctionLot,
    type EighteenXXPreferences,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type HydratedEighteenXXState,
    type Owner,
    type PendingPurchaseOffer,
    type Portfolio,
    type TileRotation
} from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import { assert, assertExists, GameStorage } from '@tabletop/common'
import type { PresentedTransition, TitlePreferences } from '@tabletop/frontend-components'
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
import { ownerPortfolio } from '../finance/ownerPortfolio.js'
import {
    draftedCertificates,
    draftedCost,
    withDraftedCompanies,
    type DraftedCompany
} from '../finance/draftedCompanies.js'
import { placedTileLayout } from '../tiles/standardTileLayouts.js'
import { terrainIconAppearance } from '../maps/terrainIcons.js'
import { createMarketAnimationSource } from '../stock/marketAnimationSource.js'
import { companySharePrice } from '../table/companyPresentation.js'
import {
    awaitedDecision,
    purchaseOfferText,
    type AwaitedDecision,
    type AwaitedDecisionNames
} from '../table/awaitedDecision.js'
import { shouldContinueHistoryStep } from '../table/historyNavigation.js'
import { operatingHistory } from '../table/operatingHistory.js'
import { wealthHistory } from '../table/wealthHistory.js'
import { shareCard, tradedCertificateIds, type ShareCard } from '../table/shareCards.js'
import { tileDrawingStyle, type TileAppearance } from '../tiles/tileAppearance.js'
import type { PhaseChangePalette } from '../table/historyPhaseChange.js'
import { tileSymbolAppearance } from '../tiles/tileSymbols.js'
import { CashCrisisModule } from './cashCrisisModule.svelte.js'
import { CompanyAuctionModule } from './companyAuctionModule.svelte.js'
import { CompanyDecisionsModule } from './companyDecisionsModule.svelte.js'
import { DiscardModule } from './discardModule.svelte.js'
import { EarningsModule } from './earningsModule.svelte.js'
import { LoanModule } from './loanModule.svelte.js'
import { LocalSelections } from './localSelections.js'
import { TitleStockPanels, type TitleStockPanel } from './titleStockPanels.svelte.js'
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
    | 'canonicalState'
> &
    Partial<Pick<EighteenXXTitleRules<Schema, State>, 'trainFundingRules'>>

type SessionOptions<
    Schema extends TitleStateSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState
> = ConstructorParameters<typeof GameSession<EighteenXXState<Schema>, State>>[0]
/** A placement of a title's own in the station step, such as 1832's Key West token. */
export type TitleStationAction = { id: string; label: string; run(): Promise<void> }

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
    privateCardTokens: Readonly<Record<string, readonly StationAppearance[]>> = $derived.by(() => ({
        ...Object.fromEntries(
            Object.entries(this.privateCompanyTokens).map(([privateCompanyId, token]) => [
                privateCompanyId,
                [token]
            ])
        ),
        ...this.titlePrivateCardTokens
    }))
    /** Cards whose header shows other tokens than the private's own, such as several companies. */
    protected titlePrivateCardTokens: Readonly<Record<string, readonly StationAppearance[]>> =
        $derived({})
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
                        placedTileLayout(this.mapView.layouts, definitionId),
                        tileDrawingStyle(this.tileAppearance)
                    )
                }
            })
        }
    }
    operatingIncomeHistory() {
        return operatingHistory(this.history.visibleContext.actions)
    }
    playerWealthHistory() {
        const { actions, state } = this.history.visibleContext
        return wealthHistory(actions, state, {
            startingCash: this.rules.startingCash({
                playerCount: state.players.length,
                config: this.game.config
            }),
            openingRound: this.presentation.openingRound,
            titleRounds: this.presentation.titleRounds
        })
    }
    readonly marketAnimation = createMarketAnimationSource(this, (state) => state.stockMarket)
    readonly preferences: TitlePreferences<typeof EighteenXXPreferences> = this.createPreferences(
        EighteenXXPreferenceDefinition
    )
    protected readonly localSelections = new LocalSelections()
    private get localHotseat() {
        return !!this.game.hotseat && this.game.storage === GameStorage.Local
    }
    // The developer harness is excluded because it switches seats itself.
    protected get ordinaryHotseatPlay() {
        return this.localHotseat && !this.isDeveloperHarness
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
            return session.ordinaryHotseatPlay
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
    get privateAuctionActive(): boolean {
        return this.offers.active || this.waterfall.active || this.selectionAuction.active
    }
    turnPlayerId(state: State = this.gameState): string | undefined {
        if (state.pendingPar) return state.pendingPar.playerId
        if (!state.activePlayerIds.length) return undefined
        return state.turnManager.currentTurn()?.playerId
    }
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
        () => this.privates.exchangeOffers.length > 0
    )
    #titleStockPanels?: TitleStockPanels<string>
    /** The title's panels beside Buy and Sell, registered for Undo and the stock menu. */
    protected titleStockPanels<Panel extends string>(
        panels: readonly TitleStockPanel<Panel>[]
    ): TitleStockPanels<Panel> {
        assert(!this.#titleStockPanels, 'A title declares its stock panels once')
        const model = new TitleStockPanels(this.stock, panels)
        this.localSelections.register(model, 'first')
        this.#titleStockPanels = model
        return model
    }
    readonly instructions = new StockInstructionModule(this.moduleSession)
    readonly earnings = new EarningsModule(this.moduleSession)
    readonly discard = new DiscardModule(this.moduleSession)
    readonly loans = new LoanModule(this.moduleSession)
    readonly cashCrisis = new CashCrisisModule(this.moduleSession)
    /**
     * Whether this player is viewing the title's published artwork (board image and token art)
     * instead of the generic presentation. A display choice only: it never changes Game State.
     * Saved per title, since each title's artwork is its own.
     */
    get publishedArtwork(): boolean {
        return this.publishedArtworkAvailable && this.preferences.values.publishedArtwork
    }
    get publishedArtworkAvailable(): boolean {
        return (
            !!this.mapViewDefinition.boardArtwork ||
            !!this.mapViewDefinition.publishedStations ||
            !!this.presentationDefinition.publishedCardImages ||
            !!this.presentationDefinition.publishedTrainColors
        )
    }
    toggleArtwork() {
        this.preferences.set({ publishedArtwork: !this.publishedArtwork }, 'title')
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
                shareCard(certificate, this.presentation, (companyId) =>
                    this.companyName(companyId)
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
    /** The plate below a published card the presentation lists, when that presentation is on. */
    publishedCardPlate(id: string | undefined): PublishedCardPlate | undefined {
        if (
            !id ||
            !this.publishedCardImage(id) ||
            !this.presentation.publishedCardPlates?.includes(id)
        )
            return undefined
        const description = this.privates.companies.find(
            (company) => company.id === id
        )?.description
        const text = /^\*\*(.+?)\*\*(?:\n\n|$)/s.exec(description ?? '')?.[1]
        return text ? { tokens: this.privateCardTokens[id] ?? [], text } : undefined
    }
    /** Tile rendering style for the current presentation, used by every tile drawn in the table. */
    readonly tileAppearance: TileAppearance = $derived.by(() => {
        const published = this.publishedArtwork
            ? this.mapViewDefinition.publishedTileAppearance
            : undefined
        return published ?? MapStyleAppearances[this.map.style]
    })
    readonly phaseChangePalette: PhaseChangePalette = $derived.by(() => ({
        phaseColors: this.presentation.phaseColors,
        phaseTileColors: Object.fromEntries(
            this.phases.phases.map((phase) => [phase.id, phase.tileColors])
        ),
        tileColors: this.tileAppearance.colors,
        tileColorNames: this.tileAppearance.colorNames ?? {}
    }))
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
    /** The title presentation for the current mode: published badge colours and market zones replace the generic ones when selected. */
    readonly presentation: TitlePresentation<EighteenXXState<Schema>> = $derived.by(() => {
        const definition = this.presentationDefinition
        if (!this.publishedArtwork) return definition
        const trains = definition.publishedTrainColors
        return {
            ...definition,
            marketZones: definition.publishedMarketZones ?? definition.marketZones,
            ...(trains && {
                trainColors: { ...definition.trainColors, ...trains },
                phaseColors: {
                    ...definition.phaseColors,
                    ...(definition.publishedPhaseColors ?? trains)
                }
            })
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
            (companyId) => this.companyName(companyId),
            (state) =>
                this.projectMapState(this.rules.state.hydrate(state, titleComponents(this.rules))),
            (state) => this.stations.openReservations(state),
            (action) => this.presentationDefinition.historyMapPlacement?.(action)
        )
        this.registerLocalSelections()
        this.addGameStateChangeListener(async ({ action }) => this.notices.observe(action))
    }
    private noticeText(action: GameAction): string | undefined {
        if (isPrivateTileLay(action))
            return `${this.getPlayerName(action.playerId)} used ${this.companyName(action.privateCompanyId)} at ${this.placeName(action.locationId)}`
        if (!isPrivateExchangeAction(action)) return undefined
        const company = this.privates.exchangeCompany(action.certificateId)
        const article = /^[AEIOU]/i.test(this.companyName(company.id)) ? 'an' : 'a'
        return `${this.getPlayerName(action.playerId)} exchanged ${this.companyName(action.privateCompanyId)} for ${article} ${this.companyName(company.id)} share`
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
    protected onStockSelectionCancelled() {
        this.#titleStockPanels?.clear()
    }
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
    awaitedDecision(state: State): AwaitedDecision | undefined {
        return (
            this.titleAwaitedDecision(state) ??
            awaitedDecision(state, this.decisionNames(state), this.rules.trainRules)
        )
    }
    purchaseOfferText(offer: PendingPurchaseOffer): string {
        return purchaseOfferText(offer, this.decisionNames(this.gameState))
    }
    protected titleAwaitedDecision(_state: State): AwaitedDecision | undefined {
        return undefined
    }
    private decisionNames(state: State): AwaitedDecisionNames {
        return {
            companyName: (companyId) => this.companyName(companyId),
            ownerName: (owner) => this.ownerName(owner),
            trainName: (trainId) => this.trainName(state, trainId),
            money: this.presentation.money
        }
    }
    private trainName(state: State, trainId: string) {
        const train = state.trainInventory.trains.find((train) => train.id === trainId)
        assertExists(train, `Train ${trainId} requires its inventory record`)
        return this.trainDepot.trainDefinition(train.definitionId).name
    }
    /** A title's own placements in the station step, offered as buttons beside its stations. */
    get titleStationActions(): readonly TitleStationAction[] {
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
    companyShareStatus(companyId: string): CompanyShareStatus | undefined {
        const company = getCompany(this.gameState, companyId)
        if (!company.started || company.closed) return undefined
        if (!company.floated) return 'unfloated'
        const soldOut =
            companySharePrice(this.stockMarketChart, this.gameState.stockMarket, companyId) !==
                undefined && this.rules.stockRules.round.soldOut(this.gameState, companyId)
        return soldOut ? 'soldOut' : undefined
    }
    playerLiquidity(playerId: string): number {
        const owner = { kind: 'player', playerId } as const
        const cash = cashOwnedBy(this.gameState, owner)
        assert(typeof cash === 'number', 'Player liquidity requires finite cash')
        const auction = this.waterfall.model
        const uncommittedCash =
            (auction && !auction.auction.completed ? auction.availableCash(playerId) : cash) -
            draftedCost(this.#draftedBy(playerId))
        return uncommittedCash + shareSaleValue(this.gameState, owner, this.rules.stockRules)
    }
    /** The companies this viewer has drafted but not yet paid for; a hidden draft's title supplies them. */
    protected get draftedCompanies(): readonly DraftedCompany[] {
        return []
    }
    #draftedBy(playerId: string): readonly DraftedCompany[] {
        return playerId === this.myPlayer?.id ? this.draftedCompanies : []
    }
    drafterOf(companyId: string): string | undefined {
        const playerId = this.myPlayer?.id
        return playerId && this.draftedCompanies.some((company) => company.companyId === companyId)
            ? playerId
            : undefined
    }
    portfolio(owner: Owner, minorsAsPrivates = false) {
        const portfolio = ownerPortfolio(
            this.gameState,
            owner,
            this.valuationRules,
            this.charters,
            minorsAsPrivates
        )
        return withDraftedCompanies(
            portfolio,
            this.gameState,
            owner.kind === 'player' ? this.#draftedBy(owner.playerId) : [],
            this.valuationRules,
            this.charters,
            minorsAsPrivates
        )
    }
    playerShares(companyId: string, playerId: string): number {
        const owned = sharesOwned(this.gameState, companyId, { kind: 'player', playerId })
        return this.drafterOf(companyId) === playerId
            ? owned + sharesOwned(this.gameState, companyId, { kind: 'bank' })
            : owned
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
    private cachedTileUpgrades: TileUpgrades | undefined
    get tileUpgrades(): TileUpgrades {
        return (this.cachedTileUpgrades ??= new TileUpgrades(this.rules.trackRules))
    }
    get operatingRules() {
        return this.rules.operatingRules
    }
    get valuationRules() {
        return this.rules.endingRules
    }
    get endingRules() {
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
    previewsHistoryMap(action: GameAction) {
        return this.historicalMaps.previews(action)
    }
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
    get names() {
        return this.rules.names
    }
    get charters() {
        return this.rules.stockRules.charters
    }
    companyName(companyId: string) {
        return this.companyNameVariants(companyId).short
    }
    companyInitials(companyId: string) {
        return this.companyNameVariants(companyId).initials
    }
    companyFullName(companyId: string) {
        return this.companyNameVariants(companyId).full
    }
    private companyNameVariants(companyId: string) {
        const names = this.presentation.companyNames[companyId]
        assertExists(names, `Company ${companyId} requires its names`)
        return names
    }
    readonly placeName = (locationId: string): string => this.mapView.map.placeName(locationId)
    lotName(lot: Pick<AuctionLot, 'id' | 'name'>) {
        return this.presentation.companyNames[lot.id]?.short ?? lot.name
    }
    lotInitials(lot: Pick<AuctionLot, 'id'>) {
        return this.presentation.companyNames[lot.id]?.initials ?? lot.id
    }
    poolName(poolId: string) {
        return this.rules.names.pool(poolId)
    }
    stockCompanyName(companyId: string) {
        return this.companyName(companyId)
    }
    get stockMarketChart() {
        return this.rules.stockRules.market
    }
    get stockCompanies() {
        const order = this.stockMarketChart.order(this.gameState.stockMarket)
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
        const drafted = this.#draftedBy(playerId).flatMap(({ companyId }) =>
            draftedCertificates(this.gameState, companyId)
        )
        return {
            count: drafted.reduce(
                (sum, certificate) => sum + this.certificateWeight(certificate),
                stockCertificateCount(this.gameState, owner, this.rules.stockRules)
            ),
            limit: this.rules.stockRules.certificateLimit(this.gameState, owner)
        }
    }
    ownerName(owner: Owner): string {
        if (owner.kind === 'player') return this.getPlayerName(owner.playerId)
        return owner.kind === 'bank' ? 'Bank' : this.companyName(owner.companyId)
    }
    // A silent swap publishes without calling any state-change listener, so layout settling
    // stays still for it; the published transition says which it was.
    restoredSilently = $state(true)
    override dispose() {
        this.notices.dispose()
        super.dispose()
    }
    override beforeNewState(transition: PresentedTransition) {
        this.restoredSilently = transition.intent === 'silent'
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

export type PublishedCardPlate = { tokens: readonly StationAppearance[]; text: string }

export type CompanyShareStatus = 'unfloated' | 'soldOut'

export type MapLocationChoice = {
    locationIds: readonly string[]
    /** Chooses a hex, with the city or town clicked within it when there was one. */
    choose(locationId: string, nodeId?: string): void
}

export type EighteenXXSessionView = GameSessionView<EighteenXXState, HydratedEighteenXXState> &
    Omit<EighteenXXSession, keyof GameSession<EighteenXXState, HydratedEighteenXXState>>
