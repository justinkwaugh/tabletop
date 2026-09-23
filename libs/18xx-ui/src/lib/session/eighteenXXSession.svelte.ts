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
import { StockModule } from './stockModule.svelte.js'
import { StockInstructionModule } from './stockInstructionModule.svelte.js'
import { MapModule } from './mapModule.svelte.js'
import { OperatingTurnModule } from './operatingTurnModule.svelte.js'
import { LocalSelections } from './localSelections.js'
import { shouldContinueHistoryStep } from '../table/historyNavigation.js'
import { operatingHistory } from '../table/operatingHistory.js'
import { shareCard, tradedCertificateIds, type ShareCard } from '../table/shareCards.js'
import {
    ClassicTileAppearance,
    MutedTileAppearance,
    type TileAppearance
} from '../tiles/tileAppearance.js'
import { createMarketAnimationSource } from '../stock/marketAnimationSource.js'
import { EighteenXXPreferenceDefinition, type EighteenXXPreferences } from '@tabletop/18xx'
import type { TitlePreferences } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import { HistoricalMaps, type HistoricalMap } from '../maps/historicalMap.js'
import {
    cashOwnedBy,
    shareSaleValue,
    priorityOrder,
    stockCertificateCount,
    stockMarketOrder,
    titleComponents
} from '@tabletop/18xx'
import { type HydratedEighteenXXState, type EighteenXXTitleRules } from '@tabletop/18xx'
import { GameStorage } from '@tabletop/common'
import { trainsOwnedBy } from '@tabletop/18xx'
import { type MapViewDefinition, type StationAppearance } from '../maps/stationPresentation.js'
import { GameSession } from '@tabletop/frontend-components'
import { assert } from '@tabletop/common'
import type { TitlePresentation } from './titlePresentation.js'
import { type EighteenXXState, getCompany, type Owner, type Portfolio } from '@tabletop/18xx'

type SessionOptions = ConstructorParameters<
    typeof GameSession<EighteenXXState, HydratedEighteenXXState>
>[0]
export class EighteenXXSession extends GameSession<EighteenXXState, HydratedEighteenXXState> {
    privateCompanyTokens: Readonly<Record<string, StationAppearance>> = $derived({})
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
    private readonly moduleSession: ModuleSession<HydratedEighteenXXState, EighteenXXTitleRules> =
        ((session: EighteenXXSession) => ({
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
                return !session.updatingVisibleState && !session.isViewingHistory
            },
            get interactive() {
                return !session.busy && !session.updatingVisibleState && !session.isViewingHistory
            },
            get hotseatPlay() {
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
            createPlayerAction: (schema, data) => session.createPlayerAction(schema, data),
            applyAction: (action) => session.applyAction(action)
        }))(this)
    readonly offers = new OfferAuctionModule(this.moduleSession)
    readonly waterfall = new WaterfallAuctionModule(this.moduleSession)
    readonly privates = new PrivatesModule(this.moduleSession)
    readonly trainFunding = new TrainFundingModule(this.moduleSession)
    readonly decisions = new CompanyDecisionsModule(this.moduleSession)
    readonly privateActions: PrivateActionsModule = new PrivateActionsModule(
        this.moduleSession,
        this.decisions,
        {
            undo: (): boolean => this.track.stages.undo(),
            clear: () => this.track.stages.clear()
        }
    )
    readonly track: TrackModule = new TrackModule(
        this.moduleSession,
        () => this.mapView,
        this.privateActions,
        this.decisions,
        () => {
            this.map.clearInspection()
        }
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
        () => this.requiresStationTokenChoice
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
        this.routes
    )
    readonly operating = new OperatingTurnModule(this.moduleSession, {
        finishTrack: () => this.track.finish(),
        finishStations: () => this.stations.finish(),
        trainSelected: () => !!this.trainBuying.depotSelection,
        hasLocalSelection: () => this.hasLocalSelection
    })
    readonly stock = new StockModule(
        this.moduleSession,
        () => this.onStockSelectionCancelled(),
        () => this.privates.exchangeOffers.length > 0,
        () => this.additionalStockMenuCount
    )
    get additionalStockMenuCount() {
        return 0
    }
    readonly instructions = new StockInstructionModule(this.moduleSession)
    readonly earnings = new EarningsModule(this.moduleSession)
    readonly discard = new DiscardModule(this.moduleSession)
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
        return (
            published ?? (this.map.style === 'muted' ? MutedTileAppearance : ClassicTileAppearance)
        )
    })
    /** The map view for the current presentation: published token art replaces the generic set when selected. */
    readonly mapView: MapViewDefinition = $derived.by(() => {
        const definition = this.mapViewDefinition
        if (!this.publishedArtwork) return definition
        if (
            !definition.publishedStations &&
            !definition.publishedLayouts &&
            !definition.publishedPlacements
        )
            return definition
        return {
            ...definition,
            stations: { ...definition.stations, ...definition.publishedStations },
            layouts: { ...definition.layouts, ...definition.publishedLayouts },
            placements: definition.publishedPlacements
        }
    })
    /** The title presentation for the current mode: published badge colours replace the generic ones when selected. */
    readonly presentation: TitlePresentation = $derived.by(() => {
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
        options: SessionOptions,
        private readonly rules: EighteenXXTitleRules,
        private readonly mapViewDefinition: MapViewDefinition,
        private readonly presentationDefinition: TitlePresentation
    ) {
        super(options)
        const { map, tileSet } = titleComponents(rules)
        assert(
            mapViewDefinition.map === map && mapViewDefinition.tileSet === tileSet,
            'The map view must present the title’s map and tile set'
        )
        this.historicalMaps = new HistoricalMaps(() => this.mapView)
        this.registerLocalSelections()
    }
    auctionLotsFor(state: EighteenXXState) {
        return (
            this.rules.offerAuctionRules?.lots(state) ?? this.rules.auctionRules?.lots(state) ?? []
        )
    }
    protected override getActivePlayers() {
        return this.gameState.activePlayerIds.flatMap((id) =>
            this.game.players.filter((player) => player.id === id)
        )
    }
    protected onStockSelectionCancelled() {}
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
        return this.rules.stockRules.round.soldOut(this.gameState, companyId)
    }
    playerLiquidity(playerId: string): number {
        const owner = { kind: 'player', playerId } as const
        const cash = cashOwnedBy(this.gameState, owner)
        assert(typeof cash === 'number', 'Player liquidity requires finite cash')
        return cash + shareSaleValue(this.gameState, owner, this.rules.stockRules)
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
    private readonly historicalMaps: HistoricalMaps
    historicalMap: HistoricalMap | undefined = $derived.by(() => {
        this.gameState
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
        this.historicalMap = this.historicalMaps.preview(context.state, context.actions, action)
    }
    closeHistoricalMap() {
        this.historicalMap = undefined
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
    }
}
export function createEighteenXXSessionClass(
    rules: EighteenXXTitleRules,
    mapView: MapViewDefinition,
    presentation: TitlePresentation
): new (options: SessionOptions) => EighteenXXSession {
    return class extends EighteenXXSession {
        constructor(options: SessionOptions) {
            super(options, rules, mapView, presentation)
        }
    }
}
export function requireEighteenXXSession(
    session: GameSession<EighteenXXState, HydratedEighteenXXState>
): EighteenXXSession {
    assert(session instanceof EighteenXXSession, 'Expected an 18xx session')
    return session
}
