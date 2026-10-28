<script lang="ts">
    import './playerTint.css'
    import {
        DefaultCompanyPricePresentation,
        type CompanyPricePresentation
    } from './companyPresentation.js'
    import {
        defaultTableView,
        firstTabbedView,
        initialTableLayout,
        tabbedTableLayout,
        restoreTableWorkspace,
        saveTableWorkspace
    } from './tableWorkspace.js'
    import { historyMapFocus } from '../maps/historyMapFocus.js'
    import { trainRouteOverlays } from '../routes/routePresentation.js'
    import { LatestRouteSolver, type RouteWorker } from '../routes/latestRouteSolver.js'
    import TableNotices from './TableNotices.svelte'
    import PrivatePowerControls from '../privates/PrivatePowerControls.svelte'
    import PositionPanel from './PositionPanel.svelte'
    import { setPlaceLinks } from '../places/placeLinks.js'
    import StandingInstruction from '../stock/StandingInstruction.svelte'
    import TurnHeading from './TurnHeading.svelte'
    import {
        companyFocusLocations,
        companyNetworkFocusLocations
    } from '../maps/companyFocusLocations.js'
    import {
        RailwayMapState,
        cashOwnedBy,
        getCompany,
        nextOperatingCompany,
        type Company,
        type OperatingRules,
        type CertificatePool
    } from '@tabletop/18xx'
    import OperatingSteps from './OperatingSteps.svelte'
    import StockActionStrip from './StockActionStrip.svelte'
    import type { StockMenuOption } from '../stock/stockActionSelection.js'
    import CompanyDetails from './CompanyDetails.svelte'
    import CompanyCardLayout from './CompanyCardLayout.svelte'
    import Lightbox from '../presentation/Lightbox.svelte'
    import CompanyOrder from './CompanyOrder.svelte'
    import CompanyOrderOverview from './CompanyOrderOverview.svelte'
    import { onMount, untrack, tick, type Snippet } from 'svelte'
    import { MediaQuery } from 'svelte/reactivity'
    import {
        DefaultTableLayout,
        GameToaster,
        TabWorkspace,
        DebouncedLayout,
        HistoryControls,
        GameChat,
        ScalingWrapper,
        setGameSession,
        toastNewChatMessages
    } from '@tabletop/frontend-components'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import {
        isMapRouteValid,
        mapSelectionRect,
        mapViewport,
        routeLocationIds,
        viewportRect,
        type MapRoute
    } from '../maps/mapDrawing.js'
    import MapScene from '../maps/MapScene.svelte'
    import HistoricalMapViewer from '../maps/HistoricalMapViewer.svelte'
    import StockMarketScene from '../stock/StockMarketScene.svelte'
    import MarketLegend from '../stock/MarketLegend.svelte'
    import { marketGeometry, marketLowerRightSpace } from '../stock/marketTokenLayout.js'
    import BoardInset from '../maps/BoardInset.svelte'
    import BoardFocus from './BoardFocus.svelte'
    import BoardAutoZoom from './BoardAutoZoom.svelte'
    import TileManifest from '../tiles/TileManifest.svelte'
    import type { NumberedShareNames } from './companyPresentation.js'
    import { spreadsheetCompanies } from './spreadsheetCompanies.js'
    import OwnershipSpreadsheet from './OwnershipSpreadsheet.svelte'
    import TrackTilePicker from '../maps/TrackTilePicker.svelte'
    import PlayersPanel from './PlayersPanel.svelte'
    import { assertExists, type BoundingBox, type GameAction } from '@tabletop/common'
    import type { TitleActionDescription } from './historyDescription.js'
    import History from './History.svelte'
    import TableHeader from './TableHeader.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import PhaseChart from '../phases/PhaseChart.svelte'
    import PhaseChartContent from '../phases/PhaseChartContent.svelte'
    import WealthChart from './WealthChart.svelte'
    import { seatOrderFrom } from './spreadsheetSort.js'
    import { LabelStacking } from './labelStacking.svelte.js'
    import type { PhaseChartData } from '../phases/phaseChart.js'
    const MapHexDiameter = 140
    const FocusRadius = 220
    const RevealMargin = 24
    let {
        session,
        additionalStockActions = [],
        gameInformation,
        boardInformation,
        auctionLotDescription,
        numberedShareLocation,
        actions,
        historyDescription,
        historySetup,
        privateOperationDescription,
        createRouteWorker
    }: {
        session: EighteenXXSessionView
        additionalStockActions?: readonly StockMenuOption[]
        gameInformation?: Snippet
        boardInformation?: Snippet
        auctionLotDescription?: (id: string) => string
        numberedShareLocation?: (companyId: string, number: number) => string | undefined
        actions: Snippet<[(locationId: string) => void, (trainId: string) => void]>
        historyDescription?: TitleActionDescription
        /** A title's account of its setup, shown as the oldest history entry. */
        historySetup?: Snippet
        privateOperationDescription: (
            privateCompanyId: string,
            companyId: string
        ) => string | undefined
        createRouteWorker: () => RouteWorker
    } = $props()
    const money = $derived(session.presentation.money)
    const {
        marketPoolId,
        ipoPoolId,
        exchangePoolId,
        companyPricePresentation = DefaultCompanyPricePresentation,
        includedCompanyIds = [],
        numberedShareNames,
        mapFocusExcludedCompanyIds = [],
        poolName,
        trainColors,
        phaseColors,
        phaseChart: defaultPhaseChart,
        portfolioCompanyIds = [],
        includedPortfolioCompanyIds = [],
        privatePurchaseLabel = 'Buy privates'
    } = $derived(session.presentation)
    const phaseChart = $derived(
        session.presentation.phaseChartFor?.(session.gameState) ?? defaultPhaseChart
    )
    const operatingRules = $derived(session.operatingRules)
    const gameOver = $derived(session.gameState.result !== undefined)
    const readOnlyPosition = $derived(
        session.isViewingHistory || gameOver || !session.myPlayer || !session.isMyTurn
    )
    const auctionShownToAll = $derived(
        !session.isViewingHistory && !gameOver && session.privateAuctionActive
    )
    const auctionTurnPlayerId = $derived(
        readOnlyPosition && auctionShownToAll ? session.turnPlayerId() : undefined
    )
    let showPhaseChart = $state(false)
    const depotState = $derived({
        depot: session.trainDepot,
        inventory: session.gameState.trainInventory,
        availableDefinitionIds: session.availableTrainDefinitionIds
    })
    const currentDepotIds = $derived(
        session.availableTrainDefinitionIds.filter(
            (id) => session.trainDepot.remaining(session.gameState.trainInventory, id) !== 0
        )
    )

    const publishedArtwork = $derived(session.publishedArtwork)
    const boardArtwork = $derived(publishedArtwork ? session.mapView.boardArtwork : undefined)
    const tileAppearance = $derived(session.tileAppearance)
    // The saved preference can also change from another window or a rejected save, so
    // the fit follows the value rather than the click.
    function framePresentation(_table: HTMLElement, initial: boolean) {
        let current = initial
        return {
            update(next: boolean) {
                if (next === current) return
                current = next
                restoreRouteView = undefined
                void tick().then(() => fitMaps())
            }
        }
    }

    let mapWrapper = $state<ScalingWrapper>()
    let boardWrapper = $state<ScalingWrapper>()
    function mapViewers() {
        return [
            ...(mapWrapper ? [{ wrapper: mapWrapper, extents: mapExtents }] : []),
            ...(boardWrapper ? [{ wrapper: boardWrapper, extents: boardExtents }] : [])
        ]
    }
    function boardViewer() {
        return boardMode ? mapWrapper : boardWrapper
    }
    const boardAutoZoom = $derived(session.preferences.values.boardAutoZoom)
    function toggleBoardAutoZoom() {
        session.preferences.set({ boardAutoZoom: !boardAutoZoom }, 'family')
    }
    function autoZooms(wrapper: ScalingWrapper) {
        return boardAutoZoom || wrapper !== boardViewer()
    }
    function autoZoomViewers() {
        return mapViewers().filter(({ wrapper }) => autoZooms(wrapper))
    }
    function fitMaps(options?: { animate?: boolean }, viewers = mapViewers()) {
        for (const { wrapper } of viewers) wrapper.fitToContent(options)
    }
    function captureMaps(): ReturnType<ScalingWrapper['captureView']> {
        const views = autoZoomViewers().map(({ wrapper }) => ({
            wrapper,
            restore: wrapper.captureView()
        }))
        return (options) => {
            for (const { wrapper, restore } of views) if (autoZooms(wrapper)) restore(options)
        }
    }
    let mapBroughtForward = false
    function showMap() {
        mapBroughtForward = true
        if (!boardWrapper?.isVisible()) selectedView = 'Map'
    }
    let focusedLocation: string | undefined = $derived.by(() => {
        session.gameState
        return undefined
    })
    async function focusLocation(locationId: string) {
        session.closeHistoricalMap()
        focusedRoute = undefined
        focusedCompany = undefined
        const restore = focusedLocation === locationId
        focusedLocation = restore ? undefined : locationId
        showMap()
        session.map.inspect({ kind: 'hex', locationId })
        await tick()
        if (restore) {
            fitMaps({ animate: true })
            return
        }
        focusLocations([locationId])
    }
    let revealedLocationId: string | undefined = $derived.by(() => {
        session.gameState
        return undefined
    })
    async function revealLocation(locationId: string) {
        session.closeHistoricalMap()
        if (revealedLocationId === locationId) {
            revealedLocationId = undefined
            return
        }
        revealedLocationId = locationId
        showMap()
        await tick()
        for (const { wrapper, extents } of mapViewers())
            wrapper.revealRect(hexViewRect(locationId, MapHexDiameter / 2, extents), {
                padding: RevealMargin,
                animate: true
            })
    }
    setPlaceLinks({
        name: (locationId) => session.placeName(locationId),
        reveal: (locationId) => void revealLocation(locationId)
    })
    let focusedCompany: string | undefined = $derived.by(() => {
        session.gameState
        return undefined
    })
    async function focusCompany(companyId: string) {
        session.closeHistoricalMap()
        focusedRoute = undefined
        const restore = focusedCompany === companyId
        focusedCompany = restore ? undefined : companyId
        focusedLocation = undefined
        showMap()
        await tick()
        if (restore) {
            fitMaps({ animate: true })
            return
        }
        const locations = companyNetworkFocusLocations(
            new RailwayMapState(
                session.mapView.map,
                session.mapView.tileSet,
                session.gameState.tileInventory
            ),
            session.stations.displayState,
            companyId
        )
        if (!locations.length) return
        focusLocations(locations)
    }
    let focusedRoute: string | undefined = $derived.by(() => {
        session.gameState
        session.updatingVisibleState
        return undefined
    })
    async function focusRoute(trainId: string) {
        session.closeHistoricalMap()
        const route = (
            session.routes.solved?.result ?? session.projectedRun.latest?.solution.result
        )?.routes.find((route) => route.trainId === trainId)
        if (!route) return
        const restore = focusedRoute === trainId
        focusedRoute = restore ? undefined : trainId
        focusedLocation = undefined
        focusedCompany = undefined
        showMap()
        await tick()
        if (restore) {
            fitMaps({ animate: true })
            return
        }
        focusLocations([...new Set(route.paths.map((path) => path.locationId))])
    }
    function previewHistoryMap(action: GameAction) {
        session.previewHistoryMap(action)
    }
    const displayedScene = $derived(session.map.displayedScene)
    const paneLayout = new MediaQuery('(min-width: 64rem)')
    const paneStripStacking = new LabelStacking()
    const actionStripStacking = new LabelStacking()
    const phoneLayout = new MediaQuery('(width < 40rem)')
    const companyCardsWrapKey = $derived(
        paneLayout.current ? 'companyCardsWrap' : 'companyCardsWrapTabbed'
    )
    const companyCardsWideKey = $derived(
        paneLayout.current ? 'companyCardsWide' : 'companyCardsWideTabbed'
    )
    const companyCardsWrap = $derived(session.preferences.values[companyCardsWrapKey])
    function toggleCompanyCardsWrap() {
        session.preferences.set({ [companyCardsWrapKey]: !companyCardsWrap }, 'family')
    }
    const companyCardsWide = $derived(session.preferences.values[companyCardsWideKey])
    function toggleCompanyCardsWide() {
        session.preferences.set({ [companyCardsWideKey]: !companyCardsWide }, 'family')
    }
    let shownCompanyCardId: string | undefined = $derived.by(() => {
        paneLayout.current
        return undefined
    })
    const boardAvailable = untrack(() => !!session.mapView.boardAreas)
    const boardMode = $derived(boardAvailable && !paneLayout.current)
    const mapOverpan = $derived(paneLayout.current ? 'both' : 'focus')
    // Below the pane layout, drags may bring the map's edge 30% into the view; focusing a hex
    // still brings it to the centre.
    const MapGestureOverpanReach = 0.3
    // The tabbed layout saves whether the chips are shown; the paned layout starts without them.
    let orderChipsShownPaned = $state(false)
    const orderChipsShown = $derived(
        paneLayout.current
            ? orderChipsShownPaned
            : session.preferences.values.operatingOrderChipsTabbed
    )
    function toggleOrderChips() {
        if (paneLayout.current) orderChipsShownPaned = !orderChipsShownPaned
        else session.preferences.set({ operatingOrderChipsTabbed: !orderChipsShown }, 'family')
    }
    let orderOverflowing = $state(false)
    let orderFirstVisible = $state(-1)
    let orderLastVisible = $state(-1)
    const orderWindowShown = $derived(orderChipsShown && orderOverflowing)
    const boardAreas = $derived(session.mapView.boardAreas)
    const bankCash = $derived.by(() => {
        const cash = cashOwnedBy(session.gameState, { kind: 'bank' })
        assertExists(cash, 'The board shows the bank, which requires a cash account')
        return cash
    })
    const boardExtents = $derived(
        [boardAreas?.market, boardAreas?.depot].filter((area) => area !== undefined)
    )
    const boardViewport = $derived(
        mapViewport(displayedScene, MapHexDiameter, boardArtwork, boardExtents)
    )
    const mapExtents = $derived(boardMode ? boardExtents : [])
    type BoardFocusTarget = 'Full' | 'Market' | 'Depot'
    let boardFocus = $state<{
        target: BoardFocusTarget
        restore: ReturnType<ScalingWrapper['captureView']>
    }>()
    function focusBoard(target: BoardFocusTarget, area?: BoundingBox) {
        const wrapper = boardViewer()
        if (!wrapper) return
        if (boardFocus?.target === target) {
            const { restore } = boardFocus
            boardFocus = undefined
            restore({ animate: true })
            return
        }
        boardFocus = { target, restore: boardFocus?.restore ?? wrapper.captureView() }
        if (area) wrapper.focusRect(viewportRect(boardViewport, area), { animate: true })
        else wrapper.fitToContent({ animate: true })
    }
    const boardFocusTarget = $derived(
        boardFocus?.target ?? (boardViewer()?.isZoomedOut() ? 'Full' : undefined)
    )
    const boardFocusOptions = $derived(
        (
            [
                ['Full', undefined],
                ['Market', boardAreas?.market],
                ['Depot', boardAreas?.depot]
            ] as const
        )
            .filter(([target, area]) => target === 'Full' || area)
            .map(([target, area]) => ({
                label: target,
                selected: boardFocusTarget === target,
                onSelect: () => focusBoard(target, area)
            }))
    )
    function focusLocations(locations: readonly string[], animate = true, viewers = mapViewers()) {
        for (const viewer of viewers) focusViewerLocations(viewer, locations, animate)
    }
    function autoFocusLocations(locations: readonly string[], animate = true) {
        focusLocations(locations, animate, autoZoomViewers())
    }
    function hexViewRect(locationId: string, radius: number, extents: readonly BoundingBox[]) {
        return mapSelectionRect(
            displayedScene,
            { kind: 'hex', locationId },
            MapHexDiameter,
            radius,
            boardArtwork,
            extents
        )
    }
    function focusViewerLocations(
        { wrapper, extents }: ReturnType<typeof mapViewers>[number],
        locations: readonly string[],
        animate: boolean
    ) {
        const rectangles = locations.map((locationId) =>
            hexViewRect(locationId, FocusRadius, extents)
        )
        const x = Math.min(...rectangles.map((rect) => rect.x))
        const y = Math.min(...rectangles.map((rect) => rect.y))
        const right = Math.max(...rectangles.map((rect) => rect.x + rect.width))
        const bottom = Math.max(...rectangles.map((rect) => rect.y + rect.height))
        wrapper.focusRect({ x, y, width: right - x, height: bottom - y }, { animate })
    }
    const consentPreview = $derived(session.gameState.trackConsent)
    const offeredCityLocationIds = $derived(
        session.stations.homeLocationIds.length
            ? session.stations.homeLocationIds
            : session.companyAuction.homeLocationIds.length
              ? session.companyAuction.homeLocationIds
              : session.stations.privateStationLocationIds
    )
    const choosingCity = $derived(offeredCityLocationIds.length > 0)
    const locationChoice = $derived(session.mapLocationChoice)
    const powerReservations = $derived.by(() => {
        const power = session.privateActions.titlePower
        return power?.kind === 'confirm' ? (power.reservations ?? []) : []
    })
    const maskPlacementLocations = $derived(
        !consentPreview &&
            (!!locationChoice ||
                choosingCity ||
                session.track.showChoices ||
                session.stations.canPlace)
    )
    const placementLocationIds = $derived(
        locationChoice
            ? locationChoice.locationIds
            : choosingCity
              ? offeredCityLocationIds
              : !session.privateActions.trackPowerSelection && session.stations.canPlace
                ? session.stations.locationIds
                : session.track.locationIds
    )
    const highlightedPlacementLocationIds = $derived(
        !locationChoice && session.track.showChoices
            ? [...new Set([...session.track.reachableLocationIds, ...placementLocationIds])]
            : placementLocationIds
    )
    const placementFocusKey = $derived(
        consentPreview?.id ??
            (maskPlacementLocations
                ? JSON.stringify([session.gameState.machineState, highlightedPlacementLocationIds])
                : undefined)
    )
    const activePlacementFocusKey = $derived(
        session.isViewingHistory || session.updatingVisibleState ? undefined : placementFocusKey
    )
    function framePlacement(_table: HTMLElement, initialKey: string | undefined) {
        let request = 0
        function frame(key: string | undefined) {
            const current = ++request
            if (!key) return
            const locations = consentPreview
                ? [consentPreview.details.locationId]
                : [...highlightedPlacementLocationIds]
            if (!locations.length) return
            showMap()
            void tick().then(() => {
                if (current === request) autoFocusLocations(locations)
            })
        }
        frame(initialKey)
        return {
            update: frame,
            destroy: () => {
                request++
            }
        }
    }
    let restoreRouteView: ReturnType<ScalingWrapper['captureView']> | undefined
    const runningCompanyId = $derived(
        !session.isViewingHistory && session.routes.editorVisible
            ? session.gameState.routeStep?.companyId
            : undefined
    )
    const routePreview = $derived(
        !session.isViewingHistory && session.routes.solved?.result.routes.length
            ? session.routes.solved
            : undefined
    )
    type RouteFraming = { runningCompanyId: string | undefined; preview: typeof routePreview }
    function frameRoutes(_table: HTMLElement, initial: RouteFraming) {
        let framed: RouteFraming = { runningCompanyId: undefined, preview: undefined }
        let request = 0
        function frame(next: RouteFraming) {
            const previous = framed
            framed = next
            if (previous.runningCompanyId && previous.runningCompanyId !== next.runningCompanyId) {
                const restore = restoreRouteView
                restoreRouteView = undefined
                if (!session.isViewingHistory) restore?.({ animate: true })
            }
            if (next.preview === previous.preview) return
            const current = ++request
            const preview = next.preview
            if (!preview) return
            focusedRoute = undefined
            focusedLocation = undefined
            focusedCompany = undefined
            showMap()
            void tick().then(() => {
                if (current !== request) return
                const locations = preview.result.routes.flatMap((route) =>
                    route.paths.map((path) => path.locationId)
                )
                restoreRouteView ??= captureMaps()
                autoFocusLocations([...new Set(locations)])
            })
        }
        frame(initial)
        return {
            update: frame,
            destroy: () => {
                request++
            }
        }
    }
    type StartCompanySelection = typeof session.stock.selectedStartCompany
    function frameStartCompany(_table: HTMLElement, initial: StartCompanySelection) {
        let returnTo:
            | { view: string; restore: ReturnType<ScalingWrapper['captureView']> | undefined }
            | undefined
        let request = 0
        function frame(selected: StartCompanySelection) {
            const current = ++request
            if (!selected) {
                const origin = returnTo
                returnTo = undefined
                if (
                    !origin ||
                    session.busy ||
                    session.updatingVisibleState ||
                    session.isViewingHistory
                )
                    return
                selectedView = origin.view
                void tick().then(() => {
                    if (current === request) origin.restore?.({ animate: true })
                })
                return
            }
            returnTo ??= { view, restore: captureMaps() }
            session.closeHistoricalMap()
            showMap()
            void tick().then(() => {
                if (current !== request) return
                const locations = companyFocusLocations(
                    session.stations.displayState,
                    selected.companyId
                )
                if (locations.length) autoFocusLocations(locations)
            })
        }
        frame(initial)
        return {
            update: frame,
            destroy: () => {
                request++
            }
        }
    }

    const historicalFocus = $derived.by(() => {
        if (!session.isViewingHistory) return undefined
        return historyMapFocus(session.gameState, session.actions.at(-1))
    })
    const historyMapSettled = $derived(
        !session.updatingVisibleState &&
            session.history.visibleContext.state.actionCount === session.gameState.actionCount
    )
    // While a history step is still settling, keep the last settled routes so the route mask
    // does not drop out between one step's map and the next. Only routes that still resolve on
    // the displayed scene are kept, and only while viewing history: during an undo the scene
    // changes before the routes do, and a stale segment would fail the map's overlay checks.
    let settledRoutes: MapRoute[] = []
    const mapRoutes = $derived.by((): MapRoute[] => {
        if (!historyMapSettled)
            return session.isViewingHistory
                ? settledRoutes.filter((route) => isMapRouteValid(displayedScene, route))
                : session.projectedRun.overlays
        settledRoutes = historicalFocus
            ? trainRouteOverlays(historicalFocus.routes)
            : session.routes.overlays.length
              ? session.routes.overlays
              : session.projectedRun.overlays
        return settledRoutes
    })
    function projectRuns(_table: HTMLElement, request: typeof session.projectedRun.request) {
        const solver = new LatestRouteSolver<NonNullable<typeof request>>(createRouteWorker, {
            solved: (solved, solution) => session.projectedRun.setSolved(solved, solution),
            failed: (failed) => session.projectedRun.setFailed(failed)
        })
        solver.solve(request)
        return {
            update: (next: typeof request) => solver.solve(next),
            destroy: () => solver.destroy()
        }
    }
    const mapMask = $derived.by(
        ():
            | { legalLocationIds: readonly string[]; highlightedLocationIds: readonly string[] }
            | undefined => {
            if (session.isViewingHistory)
                return mapRoutes.length
                    ? {
                          legalLocationIds: [],
                          highlightedLocationIds: routeLocationIds(mapRoutes, session.mapView)
                      }
                    : undefined
            if (maskPlacementLocations)
                return {
                    legalLocationIds: placementLocationIds,
                    highlightedLocationIds: highlightedPlacementLocationIds
                }
            if (routePreview && !session.routes.editor.trainId && mapRoutes.length)
                return {
                    legalLocationIds: [],
                    highlightedLocationIds: routeLocationIds(mapRoutes, session.mapView)
                }
            return undefined
        }
    )
    const settledHistoricalFocus = $derived(
        historyMapSettled && (mapWrapper || boardWrapper) ? historicalFocus : undefined
    )
    function frameHistory(_table: HTMLElement, initial: typeof settledHistoricalFocus) {
        let request = 0
        function frame(target: typeof settledHistoricalFocus) {
            const current = ++request
            if (!target) return
            void tick().then(() => {
                if (current !== request) return
                if (target.locations.length) autoFocusLocations(target.locations, false)
                else fitMaps({}, autoZoomViewers())
            })
        }
        frame(initial)
        return {
            update: frame,
            destroy: () => {
                request++
            }
        }
    }

    const gameState = $derived(session.gameState)
    const wealthPlayers = $derived(
        seatOrderFrom(
            session.gameState.players.map((player) => player.playerId),
            session.myPrimaryPlayer?.id
        ).map((playerId) => ({
            playerId,
            name: session.getPlayerName(playerId),
            color: session.colors.getPlayerBgColorValue(playerId)
        }))
    )
    const headerPlayerId = $derived(
        gameState.activePlayerIds.length === 1 ? gameState.activePlayerIds[0] : undefined
    )
    const operating = $derived(gameState.stockRound.completed && !!gameState.operatingSet)
    const operatedCompanyIds = $derived(
        operating ? (gameState.operatingSet?.completedCompanyIds ?? []) : []
    )
    const operatingCompanyId = $derived(
        operating && !gameState.result ? nextOperatingCompany(gameState) : undefined
    )
    // The current operating company's terrain costs, while play is live.
    const terrainDiscounts = $derived(
        operatingCompanyId && !session.isViewingHistory
            ? session.presentation.terrainDiscounts?.(gameState, operatingCompanyId)
            : undefined
    )
    const companyOrder = $derived(
        (operating && gameState.operatingSet
            ? gameState.operatingSet.companyOrder
            : operatingRules.companyOrder(gameState)
        ).map((id) => getCompany(gameState, id))
    )
    // Company cards and the spreadsheet follow the operating order.
    const displayedCompanyOrder = $derived(companyOrder.map((company) => company.id))
    const startedCompanies = $derived(
        spreadsheetCompanies(
            gameState,
            session.charters,
            session.actions,
            session.gameState.actionCount,
            displayedCompanyOrder,
            includedCompanyIds
        )
    )
    setGameSession(untrack(() => session))
    const layoutPreference = new DebouncedLayout(
        () => ({
            ready: session.preferences.ready,
            key: session.preferences.storageKey('family'),
            value: session.preferences.values.paneLayout
        }),
        (value) => session.preferences.save({ paneLayout: value }, 'family')
    )
    const views = [
        'Map',
        'Market',
        'Spreadsheet',
        'Companies',
        'Tiles',
        'Player Aid',
        'Actions'
    ] as const
    const sidebarViews = ['Players', 'History', 'Chat']
    let sidebarPane: HTMLDivElement | undefined = $state()
    let sidebarDeleted = $state(false)
    const tabbedSidebarShown = $derived(!paneLayout.current && !sidebarDeleted)
    let chatShown = $state(false)
    function trackChatShown(active: boolean) {
        chatShown = active
        return () => {
            chatShown = false
        }
    }
    onMount(() => toastNewChatMessages(session, () => paneLayout.current || chatShown))
    const initialView = 'Map'
    let selectedView = $state<string>(initialView)
    const view = $derived(selectedView)
    const workspaceTabs = views.map((id) => ({
        id,
        label: id,
        closable: id !== 'Actions',
        ...(id === 'Spreadsheet' ? { shortLabel: 'Sheet' } : {})
    }))
    const paneTabs = [
        ...workspaceTabs,
        { id: 'Depot', label: 'Depot', optional: true },
        { id: 'Operating Order', label: 'Operating Order', optional: true },
        { id: 'Stats', label: 'Stats', optional: true },
        ...(boardAvailable ? [{ id: 'Board', label: 'Board', optional: true }] : []),
        { id: 'Game info', label: 'Game info' },
        ...sidebarViews.map((id) => ({ id, label: id }))
    ]
    const tabbedLayout = untrack(() =>
        tabbedTableLayout({
            board: boardAvailable,
            chat: session.chatAvailable,
            gameInformation: !!gameInformation
        })
    )
    const savedTableLayout = $derived(restoreTableWorkspace(layoutPreference.value, paneTabs))
    function preferBoard() {
        untrack(() => {
            if (selectedView !== initialView) return
            selectedView = defaultTableView(savedTableLayout, paneTabs)
        })
    }

    let tabbedViewDefaulted = false
    function preferFirstTabbedView() {
        untrack(() => {
            if (tabbedViewDefaulted) return
            tabbedViewDefaulted = true
            if (mapBroughtForward || selectedView !== initialView) return
            selectedView = firstTabbedView(session.preferences.values.tabbedLayout, tabbedLayout)
        })
    }

    function navigateByShortcut(event: KeyboardEvent) {
        if (
            event.defaultPrevented ||
            event.repeat ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
        )
            return
        const target = event.target
        if (
            target instanceof HTMLElement &&
            (target.isContentEditable ||
                target.closest('input, textarea, select, [role="textbox"], [role="dialog"]'))
        )
            return
        const key = event.key.toLowerCase()
        const viewIndex = ['m', 'k', 's', 't', 'a'].indexOf(key)
        if (viewIndex >= 0) {
            event.preventDefault()
            selectedView = ['Map', 'Market', 'Spreadsheet', 'Tiles', 'Actions'][viewIndex]
            return
        }
        const sidebarIndex = ['p', 'h', 'c'].indexOf(key)
        if (sidebarIndex >= 0) {
            event.preventDefault()
            selectedView = sidebarViews[sidebarIndex]
        }
    }
</script>

<svelte:window onkeydown={navigateByShortcut} />

{#snippet playerCards()}<PlayersPanel
        {session}
        {auctionLotDescription}
        {numberedShareNames}
        {numberedShareLocation}
        onFocusLocation={focusLocation}
        {mapFocusExcludedCompanyIds}
        onFocusCompany={focusCompany}
        onShowCompanyCard={paneLayout.current
            ? undefined
            : (companyId) => (shownCompanyCardId = companyId)}
        {portfolioCompanyIds}
    />{/snippet}

{#snippet companyCard(
    company: Company,
    layout: 'wide-fill' | 'vertical' = 'vertical'
)}<CompanyDetails
        pricePresentation={companyPricePresentation}
        {layout}
        {company}
        {session}
        {trainColors}
        {poolName}
        onPreviewMap={previewHistoryMap}
    />{/snippet}

{#snippet sidebarTabIcon(id: string)}
    {#if sidebarViews.includes(id)}
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            {#if id === 'Players'}<path
                    d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6m-5 11a5 5 0 0 1 10 0Z"
                ></path>
            {:else if id === 'History'}<circle cx="10" cy="10" r="9"></circle><path
                    d="M10 4v6l4 2"
                    fill="none"
                    stroke="var(--rail-surface,#faf7f2)"
                    stroke-width="1.5"
                ></path>
            {:else}<path d="M2 2h16v12h-7l-5 4v-4H2Z"></path>{/if}
        </svg>
        {#if id === 'Chat' && session.hasUnreadMessages}<span class="unread-chat" aria-hidden="true"
            ></span>{/if}
    {/if}
{/snippet}

{#snippet historyPanel()}<History
        onPreviewMap={previewHistoryMap}
        {session}
        {trainColors}
        describeAction={historyDescription}
        setup={historySetup}
    />{/snippet}

{#snippet mapScene(interactive: boolean, extents: readonly BoundingBox[] = [])}
    <MapScene
        revenueStageColors={session.mapView.revenueStageColors}
        scene={displayedScene}
        artwork={boardArtwork}
        tokens={session.map.displayedTokens}
        stationAppearances={session.mapView.stations}
        reservations={[...session.map.displayedReservations, ...powerReservations]}
        routes={mapRoutes}
        selection={session.isViewingHistory
            ? historyMapSettled
                ? historicalFocus?.selection
                : undefined
            : session.map.selection}
        maskUnavailableLocations={!!mapMask}
        legalLocationIds={mapMask?.legalLocationIds}
        highlightedLocationIds={mapMask?.highlightedLocationIds}
        previewLocationId={session.track.displayedPreview?.locationId ??
            session.stations.preview?.position.locationId}
        translucentLocationId={consentPreview?.details.locationId}
        appearance={tileAppearance}
        hexDiameter={MapHexDiameter}
        outlinedLocationIds={revealedLocationId ? [revealedLocationId] : []}
        {extents}
        {terrainDiscounts}
        onselect={interactive && !consentPreview
            ? (selection) =>
                  locationChoice?.locationIds.includes(selection.locationId)
                      ? locationChoice.choose(
                            selection.locationId,
                            'nodeId' in selection ? selection.nodeId : undefined
                        )
                      : session.map.select(selection, false)
            : undefined}
    />
{/snippet}

{#snippet boardInsets()}
    {#if boardAreas?.market}<BoardInset
            label="Stock market"
            area={viewportRect(boardViewport, boardAreas.market)}
        >
            {@const corner = boardInformation
                ? marketLowerRightSpace(
                      session.stockMarketChart,
                      marketGeometry(
                          session.stockMarketChart,
                          session.presentation.marketCell,
                          session.presentation.marketZones
                      )
                  )
                : undefined}
            <div class="board-market">
                <StockMarketScene
                    cell={session.presentation.marketCell}
                    animation={session.marketAnimation}
                    appearances={session.mapView.stations}
                    chart={session.stockMarketChart}
                    market={session.gameState.stockMarket}
                    companyName={(companyId) => session.companyName(companyId)}
                    zones={session.presentation.marketZones}
                    ledge={session.presentation.marketLedge}
                />
                {#if boardInformation && corner}<div
                        class="market-corner"
                        style:left={`${corner.x}px`}
                        style:top={`${corner.y}px`}
                        style:width={`${corner.width}px`}
                        style:height={`${corner.height}px`}
                    >
                        {@render boardInformation()}
                    </div>{/if}
            </div>
        </BoardInset>{/if}
    {#if boardAreas?.depot}<BoardInset
            label="Train depot"
            area={viewportRect(boardViewport, boardAreas.depot)}
        >
            <div class="board-depot">
                <PhaseChartContent
                    {money}
                    {depotState}
                    depotOnly
                    onBoard
                    bank={{ cash: bankCash, broken: !!session.gameState.bank.broken }}
                    chart={phaseChart}
                    currentPhaseId={session.gameState.phaseId}
                    {trainColors}
                    {phaseColors}
                    tileColors={tileAppearance.colors}
                    tileColorNames={tileAppearance.colorNames}
                />
            </div>
        </BoardInset>{/if}
{/snippet}

{#snippet historyControls(bordered = true)}
    <HistoryControls
        borderClass={bordered ? 'border-b border-[var(--rail-border,#b8a995)]' : ''}
        enabledColor="text-[var(--rail-text,#695540)]"
        disabledColor="text-[var(--rail-inactive,#b9ae9f)]"
        bgClass="bg-transparent"
    />
{/snippet}

{#snippet gameInformationStrip(stacking: LabelStacking)}
    <button
        class="game-information"
        onclick={() => (showPhaseChart = true)}
        aria-haspopup="dialog"
        aria-label="Open phase chart"
        {@attach (row) => {
            session.gameState
            return stacking.attach(row)
        }}
    >
        <span class="game-information-item">
            <span class="information-label">Phase</span>
            <TrainBadge
                name={session.gameState.phaseId}
                color={phaseColors[session.gameState.phaseId]}
            />
        </span>
        <span class="game-information-item">
            <span
                class="information-label train-limit-label"
                class:stacked={stacking.stacked}
                data-stacking-label><span>Train</span> <span>limit</span></span
            >
            <span class="train-limit-value"
                >{phaseChart.phases.find((phase) => phase.id === session.gameState.phaseId)
                    ?.trainLimit}</span
            >
        </span>
        <span class="game-information-item depot-information">
            <span class="information-label">Depot</span>
            {#each currentDepotIds as currentDepotId (currentDepotId)}
                {@const remaining = session.trainDepot.remaining(
                    session.gameState.trainInventory,
                    currentDepotId
                )}
                <span class="depot-type"
                    ><TrainBadge
                        name={session.trainDepot.trainDefinition(currentDepotId).name}
                        color={trainColors[currentDepotId]}
                    />
                    <span class="depot-count"
                        >{remaining === 'unlimited' ? '∞' : `×${remaining}`}</span
                    ></span
                >
            {:else}<span>Empty</span>{/each}
        </span>
        {#if session.loans.rate !== undefined}
            <span class="game-information-item">
                <span class="information-label">Interest</span>
                <span
                    >{session.loans.rate}%
                    <span class="next-rate">next {session.loans.nextRate}%</span></span
                >
            </span>
            <span class="game-information-item">
                <span class="information-label">Loans</span>
                <span>{session.loans.remaining} left</span>
            </span>
        {/if}
        {#each session.presentation.gameFacts?.(session.gameState) ?? [] as fact (fact.label)}
            <span class="game-information-item">
                <span class="information-label">{fact.label}</span>
                <span class="information-value">{fact.value}</span>
            </span>
        {/each}
    </button>
{/snippet}
{#snippet sidebarInformation()}
    {#if paneLayout.current}{@render gameInformationStrip(paneStripStacking)}{/if}
    {#if gameInformation}{@render gameInformation()}{/if}
{/snippet}
{#snippet chatPanel()}
    <GameChat
        framed={!paneLayout.current}
        timeColor="text-[var(--rail-muted,#887969)]"
        messageTextColor="text-[var(--rail-text,#4b4239)]"
        composerTextColor="text-[var(--rail-text,#4b4239)]"
        messageHoverColor="hover:bg-[var(--rail-surface-raised,#e7ded3)]"
        inputBgColor="bg-[var(--rail-surface,#faf7f2)]"
        inputBorderColor="border-[var(--rail-border,#b8a995)]"
        borderColor="border-[var(--rail-border,#b8a995)]"
    />
{/snippet}

<GameToaster />
<div
    class="railway-table"
    class:published-artwork={publishedArtwork}
    use:framePlacement={activePlacementFocusKey}
    use:frameRoutes={{ runningCompanyId, preview: routePreview }}
    use:frameStartCompany={session.stock.selectedStartCompany}
    use:frameHistory={settledHistoricalFocus}
    use:projectRuns={session.projectedRun.request}
    use:framePresentation={publishedArtwork}
    style:--rail-table-background={boardArtwork?.backgroundColor}
    data-theme="dark"
    aria-label="Game table"
    aria-busy={!session.preferences.ready}
>
    {#if session.preferences.ready && layoutPreference.ready}
        <DefaultTableLayout
            topPadding={0}
            horizontalPadding={paneLayout.current || (phoneLayout.current && tabbedSidebarShown)
                ? 0
                : 8}
            showSidebar={tabbedSidebarShown}
        >
            {#snippet mobileControlsContent()}
                {@render historyControls()}
            {/snippet}
            {#snippet sideContent()}
                <div class="max-sm:hidden">{@render historyControls()}</div>
                <div class="sidebar-pane" bind:this={sidebarPane}></div>
            {/snippet}
            {#snippet gameContent()}
                <div
                    class="game-heading"
                    class:workspace-heading={paneLayout.current}
                    class:player-tinted-header={paneLayout.current && !!headerPlayerId}
                    style:--player-color={headerPlayerId
                        ? session.colors.getPlayerBgColorValue(headerPlayerId)
                        : undefined}
                >
                    {#if paneLayout.current}<div class="workspace-history-controls">
                            {@render historyControls(false)}
                        </div>{:else if !tabbedSidebarShown}<div class="max-sm:hidden">
                            {@render historyControls()}
                        </div>{/if}
                    <div class="table-heading">
                        <TableHeader
                            artworkAvailable={session.publishedArtworkAvailable}
                            {publishedArtwork}
                            onToggleArtwork={() => session.toggleArtwork()}
                            {session}
                            bordered={!paneLayout.current}
                            centered={paneLayout.current}
                        />
                    </div>
                </div>
                {#if paneLayout.current && layoutPreference.status}
                    <button
                        class="layout-save"
                        disabled={layoutPreference.status === 'saving' ||
                            layoutPreference.status === 'saved'}
                        onclick={() => layoutPreference.save()}
                        title="Layout saves automatically after three seconds without changes. Click to save now."
                    >
                        {layoutPreference.status === 'unsaved'
                            ? 'Layout unsaved'
                            : layoutPreference.status === 'saving'
                              ? 'Saving…'
                              : layoutPreference.status === 'error'
                                ? 'Layout not saved · Retry'
                                : 'Saved'}
                    </button>
                {/if}
                {#snippet operatingOrderContent()}
                    {#if operating && !gameState.result && companyOrder.length}
                        <div class="operating-order-footer">
                            <div class="order-display">
                                <button
                                    class="order-overview-toggle"
                                    aria-label="Operating order chips"
                                    aria-expanded={orderChipsShown}
                                    onclick={toggleOrderChips}
                                >
                                    <CompanyOrderOverview
                                        companies={companyOrder}
                                        appearances={session.mapView.stations}
                                        firstVisible={orderWindowShown ? orderFirstVisible : -1}
                                        lastVisible={orderWindowShown ? orderLastVisible : -1}
                                        completedCompanyIds={operatedCompanyIds}
                                        currentCompanyId={operatingCompanyId}
                                    />
                                </button>
                            </div>
                            {#if orderChipsShown}<CompanyOrder
                                    overview={false}
                                    bind:overflowing={orderOverflowing}
                                    bind:firstVisible={orderFirstVisible}
                                    bind:lastVisible={orderLastVisible}
                                    {money}
                                    showDetails
                                    companies={companyOrder}
                                    companyName={(companyId) => session.companyName(companyId)}
                                    {gameState}
                                    trainDepot={session.trainDepot}
                                    {trainColors}
                                    requiresTrain={(companyId) =>
                                        session.companyRequiresTrain(companyId)}
                                    appearances={session.mapView.stations}
                                    completedCompanyIds={operatedCompanyIds}
                                    currentCompanyId={operatingCompanyId}
                                    restoredSilently={session.restoredSilently}
                                >
                                    {#snippet companyDetails(company)}
                                        <CompanyDetails
                                            pricePresentation={companyPricePresentation}
                                            onPreviewMap={previewHistoryMap}
                                            {trainColors}
                                            {session}
                                            {company}
                                            {poolName}
                                        />
                                    {/snippet}
                                </CompanyOrder>{/if}
                        </div>
                    {/if}
                {/snippet}
                {#snippet actionContent()}
                    <div class="action-body">
                        <div class="action-information">
                            {@render gameInformationStrip(actionStripStacking)}
                        </div>
                        <TableNotices notices={session.notices} />
                        <OperatingSteps
                            {session}
                            {privatePurchaseLabel}
                            readOnly={readOnlyPosition}
                        />
                        {#if !session.isViewingHistory}
                            <StockActionStrip
                                {session}
                                additionalActions={additionalStockActions}
                                readOnly={readOnlyPosition}
                            />
                            <PrivatePowerControls {session} />
                        {/if}
                        <section class="action-panel" aria-label="Current action">
                            {#if readOnlyPosition && !auctionShownToAll}
                                <PositionPanel
                                    {session}
                                    {trainColors}
                                    describeAction={historyDescription}
                                />
                                {#if !session.isViewingHistory}<StandingInstruction
                                        {session}
                                    />{/if}
                            {:else}
                                {#if auctionTurnPlayerId}<TurnHeading
                                        {session}
                                        playerIds={[auctionTurnPlayerId]}
                                    />{/if}
                                {@render actions(focusLocation, focusRoute)}
                            {/if}
                        </section>
                    </div>
                    {#if !paneLayout.current}{@render operatingOrderContent()}{/if}
                {/snippet}
                {#snippet children(id: string, active: boolean)}
                    {#if id === 'Game info'}<div class="workspace-view game-info-pane">
                            {@render sidebarInformation()}
                        </div>
                    {:else if id === 'Player Aid'}<div class="workspace-view">
                            <PhaseChartContent
                                {money}
                                {depotState}
                                chart={phaseChart}
                                currentPhaseId={gameState.phaseId}
                                {trainColors}
                                {phaseColors}
                                tileColors={tileAppearance.colors}
                                tileColorNames={tileAppearance.colorNames}
                            />
                        </div>
                    {:else if id === 'Depot'}<div class="workspace-view">
                            <PhaseChartContent
                                {money}
                                {depotState}
                                depotOnly
                                chart={phaseChart}
                                currentPhaseId={session.gameState.phaseId}
                                {trainColors}
                                {phaseColors}
                                tileColors={tileAppearance.colors}
                                tileColorNames={tileAppearance.colorNames}
                            />
                        </div>
                    {:else if id === 'Stats'}<div class="workspace-view">
                            {#if active}<WealthChart
                                    {money}
                                    points={session.playerWealthHistory()}
                                    players={wealthPlayers}
                                />{/if}
                        </div>
                    {:else if id === 'Players'}<div class="workspace-view players-pane">
                            {@render playerCards()}
                        </div>
                    {:else if id === 'History'}<div class="workspace-view self-scrolling">
                            {@render historyPanel()}
                        </div>
                    {:else if id === 'Chat'}<div
                            class="workspace-view"
                            {@attach () => trackChatShown(active)}
                        >
                            {#if active}{@render chatPanel()}{/if}
                        </div>
                    {:else if id === 'Operating Order'}<div class="workspace-view">
                            {@render operatingOrderContent()}{#if !operating || gameState.result || !companyOrder.length}<p
                                    class="widget-empty"
                                >
                                    No operating order this round.
                                </p>{/if}
                        </div>
                    {:else if id === 'Actions'}<div class="workspace-view actions-area">
                            {@render actionContent()}
                        </div>{:else if id === 'Map'}<div
                            class="workspace-view map-area"
                            class:board-area={boardMode}
                        >
                            {#if boardMode}<div class="board-focus-strip">
                                    <BoardFocus options={boardFocusOptions} />
                                    <BoardAutoZoom
                                        small
                                        enabled={boardAutoZoom}
                                        onToggle={toggleBoardAutoZoom}
                                    />
                                </div>{/if}
                            <ScalingWrapper
                                bind:this={mapWrapper}
                                maxScale={2}
                                overpan={mapOverpan}
                                gestureOverpanReach={MapGestureOverpanReach}
                                onManualViewChange={() => {
                                    restoreRouteView = undefined
                                    boardFocus = undefined
                                }}
                                justify="center"
                                controls="bottom-left"
                                expandable={true}
                            >
                                {#if boardMode}<div class="board-view">
                                        {@render mapScene(true, boardExtents)}
                                        {@render boardInsets()}
                                    </div>
                                {:else}{@render mapScene(true)}{/if}
                                {#snippet overlay(viewport)}
                                    {#if active && session.track.canBuild && session.track.selection.locationId}
                                        <TrackTilePicker
                                            {session}
                                            {viewport}
                                            appearance={tileAppearance}
                                        />
                                    {/if}
                                {/snippet}
                            </ScalingWrapper>
                        </div>{:else if id === 'Board'}<div class="workspace-view map-area">
                            <ScalingWrapper
                                bind:this={boardWrapper}
                                insetTop={44}
                                overpan={mapOverpan}
                                gestureOverpanReach={MapGestureOverpanReach}
                                justify="center"
                                controls="bottom-left"
                                expandable={true}
                                allowFullscreenShortcut={() => !mapWrapper?.isVisible()}
                                onManualViewChange={() => {
                                    restoreRouteView = undefined
                                    boardFocus = undefined
                                }}
                            >
                                <div class="board-view">
                                    {@render mapScene(true, boardExtents)}
                                    {@render boardInsets()}
                                </div>
                                {#snippet overlay(viewport)}
                                    <div class="board-focus-overlay">
                                        <BoardFocus options={boardFocusOptions} />
                                    </div>
                                    <div class="board-auto-zoom-overlay">
                                        <BoardAutoZoom
                                            enabled={boardAutoZoom}
                                            onToggle={toggleBoardAutoZoom}
                                        />
                                    </div>
                                    {#if active && session.track.canBuild && session.track.selection.locationId}
                                        <TrackTilePicker
                                            {session}
                                            {viewport}
                                            appearance={tileAppearance}
                                        />
                                    {/if}
                                {/snippet}
                            </ScalingWrapper>
                        </div>{:else if id === 'Market'}<div class="workspace-view market-area">
                            <div class="market-scene">
                                <ScalingWrapper
                                    justify="center"
                                    controls="bottom-left"
                                    expandable={true}
                                    allowFullscreenShortcut={() => !mapWrapper?.isVisible()}
                                >
                                    <StockMarketScene
                                        cell={session.presentation.marketCell}
                                        animation={session.marketAnimation}
                                        appearances={session.mapView.stations}
                                        renderScale={2}
                                        chart={session.stockMarketChart}
                                        market={session.gameState.stockMarket}
                                        companyName={(companyId) => session.companyName(companyId)}
                                        zones={session.presentation.marketZones}
                                        ledge={session.presentation.marketLedge}
                                    />
                                </ScalingWrapper>
                            </div>
                            {#if !session.presentation.hideMarketLegend && (session.presentation.marketZones?.length || session.presentation.marketLedge)}<MarketLegend
                                    zones={session.presentation.marketZones ?? []}
                                    ledge={session.presentation.marketLedge}
                                />{/if}
                        </div>{:else if id === 'Spreadsheet'}<div class="workspace-view data-area">
                            <OwnershipSpreadsheet
                                pricePresentation={companyPricePresentation}
                                fillWidth={paneLayout.current}
                                {includedPortfolioCompanyIds}
                                companyOrder={displayedCompanyOrder}
                                onPreviewMap={previewHistoryMap}
                                {trainColors}
                                {session}
                                {numberedShareNames}
                                {includedCompanyIds}
                                {marketPoolId}
                                {ipoPoolId}
                                {exchangePoolId}
                                {portfolioCompanyIds}
                            />
                        </div>{:else if id === 'Companies'}<div class="workspace-view">
                            <CompanyCardLayout
                                wrap={companyCardsWrap}
                                onToggleWrap={toggleCompanyCardsWrap}
                                wide={companyCardsWide}
                                onToggleWide={toggleCompanyCardsWide}
                            >
                                {#each startedCompanies as company (company.id)}
                                    {@render companyCard(
                                        company,
                                        companyCardsWide ? 'wide-fill' : 'vertical'
                                    )}
                                {:else}<p class="widget-empty">No companies have started.</p>{/each}
                            </CompanyCardLayout>
                        </div>{:else if id === 'Tiles'}<div class="workspace-view">
                            <TileManifest
                                tiles={session.mapView.tileSet.definitions}
                                inventory={session.map.tileCounts}
                                upgrades={session.tileUpgrades}
                                layouts={session.mapView.layouts}
                                orientation={session.mapView.map.definition.orientation}
                                appearance={tileAppearance}
                            />
                        </div>{/if}
                {/snippet}
                {#if paneLayout.current}
                    <div class="pane-workspace" {@attach preferBoard}>
                        <TabWorkspace
                            tabs={paneTabs}
                            savedLayout={savedTableLayout}
                            onLayoutChange={(value) =>
                                layoutPreference.change(saveTableWorkspace(value))}
                            tabTitle={sidebarTabIcon}
                            bind:selected={selectedView}
                            label="Table views"
                            initialLayout={initialTableLayout(paneTabs)}
                            {children}
                        />
                    </div>
                {:else}
                    <div class="stacked-body">
                        <div class="original-actions">{@render actionContent()}</div>
                        <div class="stacked-workspace" {@attach preferFirstTabbedView}>
                            <TabWorkspace
                                tabs={tabbedLayout.tabs}
                                fixedPane={{
                                    target: sidebarPane,
                                    tabs: tabbedLayout.sidebarAccepts,
                                    label: 'Sidebar',
                                    deletable: true
                                }}
                                bind:fixedPaneDeleted={sidebarDeleted}
                                initialLayout={tabbedLayout.initial}
                                tabTitle={sidebarTabIcon}
                                savedLayout={session.preferences.values.tabbedLayout}
                                onLayoutChange={(value) =>
                                    session.preferences.set({ tabbedLayout: value }, 'family')}
                                bind:selected={selectedView}
                                label="Table views"
                                splittable={false}
                                {children}
                            />
                        </div>
                    </div>
                {/if}
            {/snippet}
        </DefaultTableLayout>

        {#if showPhaseChart}<PhaseChart
                {money}
                {depotState}
                chart={phaseChart}
                currentPhaseId={session.gameState.phaseId}
                {trainColors}
                {phaseColors}
                tileColors={tileAppearance.colors}
                tileColorNames={tileAppearance.colorNames}
                onclose={() => (showPhaseChart = false)}
            />{/if}

        {#if shownCompanyCardId}
            <Lightbox
                label={session.companyName(shownCompanyCardId)}
                onclose={() => (shownCompanyCardId = undefined)}
            >
                {@render companyCard(getCompany(gameState, shownCompanyCardId))}
            </Lightbox>
        {/if}

        {#if session.historicalMap}
            <HistoricalMapViewer
                {money}
                artwork={boardArtwork}
                preview={session.historicalMap}
                revenueStageColors={session.mapView.revenueStageColors}
                appearance={tileAppearance}
                onclose={() => session.closeHistoricalMap()}
            />
        {/if}
    {/if}
</div>

<style>
    .layout-save {
        align-self: flex-end;
        flex: none;
        border: 0;
        background: transparent;
        color: var(--rail-muted, #887969);
        font-size: 11px;
        padding: 2px 8px;
        cursor: pointer;
    }
    .unread-chat {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #f43f5e;
    }
    .pane-workspace {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
    }
    .sidebar-pane {
        position: relative;
        flex: 1;
        min-height: 0;
    }
    .stacked-workspace {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 50dvh;
    }
    .game-heading {
        flex: none;
    }
    .stacked-body {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: auto;
        overscroll-behavior-y: none;
    }
    .workspace-heading {
        padding-inline: 8px;
        display: flex;
        flex: none;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid var(--rail-border, #b8a995);
    }
    .workspace-history-controls {
        width: 320px;
        flex: none;
    }
    .table-heading {
        flex: 1;
        min-width: 0;
    }
    .game-info-pane {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 8px;
        box-sizing: border-box;
    }
    .game-info-pane .game-information {
        padding-inline: 8px;
    }
    .original-actions {
        --stock-buy-wrap: nowrap;
        --stock-buy-overflow: auto;
        flex: none;
    }
    .workspace-view {
        height: 100%;
        min-height: 0;
        min-width: 0;
        overflow: auto;
    }
    /* iOS Safari rubber-bands an overflow: auto box sideways even when nothing overflows. */
    .self-scrolling {
        overflow: hidden;
    }
    .players-pane {
        container: player-pane / size;
        padding: 10px 8px 0;
        box-sizing: border-box;
    }
    .actions-area {
        container: action-pane / size;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .actions-area .action-body {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: auto;
    }
    .action-information .game-information {
        justify-content: center;
        column-gap: 24px;
        margin-top: 0;
        padding: 4px 12px;
    }
    .actions-area .action-panel {
        flex: 1 0 auto;
    }
    .widget-empty {
        padding: 16px;
        color: var(--rail-muted, #887969);
    }
    .order-display {
        display: flex;
        justify-content: center;
        padding-top: 6px;
    }
    .order-overview-toggle {
        padding: 0;
        border: 0;
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
    }
    .order-overview-toggle:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 1px;
    }
    .railway-table {
        --workspace-text: var(--rail-text, #443c34);
        --workspace-muted: var(--rail-muted, #887969);
        --workspace-inactive: var(--rail-inactive, #938371);
        --workspace-border: var(--rail-border, #d2c5b7);
        --workspace-focus: var(--rail-focus, #7c634b);
        --workspace-hover: var(--rail-hover, #69554016);
        --workspace-surface: var(--rail-surface, #faf7f2);
        --workspace-danger: var(--rail-negative, #b33a32);
    }
    .railway-table {
        color-scheme: dark;
        --rail-text: #e3e9ef;
        --rail-negative: #ff9c91;
        --rail-phase-tint: 100%;
        --rail-phase-filter: none;
        --rail-phase-opacity: 1;
        --rail-muted: #7f8e9e;
        --rail-inactive: #596777;
        --rail-surface: #222c37;
        --rail-surface-inset: #1b232d;
        --rail-surface-raised: #2b3744;
        --rail-surface-selected: #3a4c5e;
        --rail-solid: #40576b;
        --rail-border: #485666;
        --rail-interstitial-border: #18212b;
        --rail-focus: #b8cddd;
        --rail-hover: #b8cddd18;
        --rail-shadow: #00000055;
        --rail-backdrop: #080f18bb;
        --rail-table-background: #18212b;
    }
    /* Published artwork: the board's own palette. Bright text is its light tan paper, dimmed
       text the grey-tan of its stock market figures, and surfaces its slate market cells on the
       near-black slate ground (MAP-JUNE-for-print: ground #1a292c, cells #213742, figures #b2a994). */
    .railway-table.published-artwork {
        --rail-text: #e6dbce;
        --rail-muted: #a8a094;
        --rail-inactive: #7a746a;
        --rail-border: #34474f;
        --rail-solid: #2c4652;
        --rail-interstitial-border: #1a292c;
        --rail-surface: #213742;
        --rail-surface-inset: #182427;
        --rail-surface-raised: #29434f;
        --rail-surface-selected: #34505e;
        --rail-hover: #e6dbce18;
        --rail-focus: #e6dbce;
    }
    /* The history round index floats over the page, so it takes the page's dark background. */
    .railway-table.published-artwork :global(.round-index) {
        background: var(--rail-table-background);
    }
    /* Inactive tabs read in the dimmed-text colour, like the game information labels. */
    .railway-table.published-artwork :global([role='tab'][aria-selected='false']) {
        color: var(--rail-muted);
    }
    .game-information {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex: none;
        gap: 3px;
        flex-wrap: wrap;
        width: 100%;
        box-sizing: border-box;
        margin-top: -8px;
        padding: 6px;
        border: 0;
        border-bottom: 1px solid var(--rail-border, #b8a995);
        background: transparent;
        color: var(--rail-text, #514536);
        font: inherit;
        font-size: 12px;
        line-height: 20px;
        text-align: inherit;
        cursor: pointer;
    }
    .game-information:hover {
        background: var(--rail-hover, #ffffff66);
    }
    .game-information:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: -2px;
    }
    @media (width < 40rem) {
        .game-information {
            margin-top: 0;
        }
    }
    .game-information-item {
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
    }
    .next-rate {
        color: var(--rail-muted, #887969);
    }
    .depot-type {
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }
    .depot-information {
        flex-wrap: wrap;
        justify-content: flex-end;
    }
    .depot-count {
        font-size: 12px;
        font-weight: 700;
        line-height: 16px;
        font-variant-numeric: tabular-nums;
    }
    .train-limit-label {
        display: inline-flex;
        column-gap: 0.3em;
        line-height: 10px;
    }
    .train-limit-label.stacked {
        flex-direction: column;
        align-items: center;
    }
    .train-limit-value,
    .information-value {
        font-size: 16px;
        font-weight: 700;
        line-height: 20px;
    }
    .information-label {
        color: var(--rail-muted, #887969);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        line-height: 1;
    }

    .railway-table {
        background: var(--rail-table-background, #ede2dc);
        color: var(--rail-text, #443c34);
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .railway-table :global(.railway-tab-label) {
        font-size: 11px;
        font-weight: 600;
        line-height: 1.5;
        letter-spacing: 0.07em;
        text-transform: uppercase;
    }
    .action-panel {
        flex-shrink: 0;
        min-height: 0;
        overflow: auto;
        padding: 10px 16px;
        background: var(--rail-surface, #faf7f1);
        border-bottom: 1px solid var(--rail-border, #b8a995);
        font-size: 13px;
    }
    .action-panel:has(:global(.centered-panel)) {
        display: flex;
        flex-direction: column;
        overflow: visible;
    }
    .action-panel :global(section) {
        padding: 0;
        margin: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
    }
    .action-panel :global(.centered-panel) {
        margin-block: auto;
    }
    @container action-pane (min-width: 500px) {
        .action-panel:has(:global(.sales-sidebar)) {
            display: flex;
            flex-direction: column;
            padding: 0;
        }
        .action-panel :global(section.stock-trading:has(.sales-sidebar)) {
            flex: 1;
            margin-block: 0;
        }
    }
    .action-panel :global(h2) {
        font-size: 14px;
    }
    .action-panel :global(button) {
        font-size: 12px;
        font-weight: 400;
    }
    .action-panel :global(button.action-button) {
        background: var(--rail-solid, #443e35);
        border-color: var(--rail-focus, #443e35);
        color: #fff;
    }
    .action-panel :global(button.action-button:hover:not(:disabled)) {
        background: var(--rail-solid, #302c26);
        border-color: var(--rail-focus, #302c26);
    }
    .action-panel :global(header button.inline-action) {
        font: inherit;
        border: 0;
        padding: 3px 8px;
        border-radius: 4px;
    }
    .action-panel :global(button strong) {
        font-weight: 400;
    }
    .map-area {
        position: relative;
    }
    .map-area.board-area {
        display: flex;
        flex-direction: column;
    }
    .board-area > :global(:last-child) {
        flex: 1;
        min-height: 0;
    }
    .board-focus-strip {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(max-content, 1fr);
        flex: none;
        align-items: center;
        border-bottom: 1px solid var(--rail-border, #b8a995);
    }
    .board-focus-strip > :global(:first-child) {
        grid-column: 2;
    }
    .board-focus-strip > :global(:first-child button) {
        padding: 2px 12px;
        font-size: 11px;
    }
    .board-focus-strip > :global(.view-switch) {
        justify-self: end;
    }
    .board-focus-overlay,
    .board-auto-zoom-overlay {
        position: absolute;
        top: 8px;
        z-index: 2;
        border-radius: 999px;
        box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
    }
    .board-focus-overlay {
        left: 8px;
    }
    .board-auto-zoom-overlay {
        right: 8px;
    }
    .board-view {
        position: relative;
        width: max-content;
    }
    .board-view > :global(svg) {
        display: block;
    }
    .board-market {
        position: relative;
    }
    .market-corner,
    .board-depot {
        pointer-events: auto;
    }
    .market-corner {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .map-area {
        overflow: hidden;
    }
    .market-area {
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .market-scene {
        position: relative;
        flex: 1;
        min-height: 0;
    }
    .data-area {
        padding-bottom: 8px;
    }
</style>
