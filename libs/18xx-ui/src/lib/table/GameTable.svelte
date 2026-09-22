<script lang="ts">
    import './playerTint.css'
    import {
        DefaultCompanyPricePresentation,
        type CompanyPricePresentation
    } from './companyPresentation.js'
    import { tableHeaderState } from './tableHeaderState.js'
    import {
        initialTableLayout,
        restoreTableWorkspace,
        saveTableWorkspace
    } from './tableWorkspace.js'
    import { historyMapFocus } from '../maps/historyMapFocus.js'
    import { routeColor } from '../routes/routePresentation.js'
    import PositionPanel from './PositionPanel.svelte'
    import {
        companyFocusLocations,
        companyNetworkFocusLocations
    } from '../maps/companyFocusLocations.js'
    import {
        RailwayMapState,
        getCompany,
        nextOperatingCompany,
        type OperatingRules,
        type CertificatePool
    } from '@tabletop/18xx'
    import type { ValuationRules } from '@tabletop/18xx'
    import OperatingSteps from './OperatingSteps.svelte'
    import StockActionStrip from './StockActionStrip.svelte'
    import type { StockMenuOption } from '../stock/stockActionSelection.js'
    import CompanyDetails from './CompanyDetails.svelte'
    import CompanyCardLayout from './CompanyCardLayout.svelte'
    import CompanyOrder from './CompanyOrder.svelte'
    import CompanyOrderToggle from './CompanyOrderToggle.svelte'
    import { untrack, tick, type Snippet } from 'svelte'
    import { MediaQuery } from 'svelte/reactivity'
    import {
        DefaultTableLayout,
        DefaultTabs,
        TabWorkspace,
        DebouncedLayout,
        HistoryControls,
        GameChat,
        ScalingWrapper,
        setGameSession
    } from '@tabletop/frontend-components'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import { mapSelectionRect, routeLocationIds } from '../maps/mapDrawing.js'
    import MapScene from '../maps/MapScene.svelte'
    import HistoricalMapViewer from '../maps/HistoricalMapViewer.svelte'
    import StockMarketScene from '../stock/StockMarketScene.svelte'
    import TileManifest from '../tiles/TileManifest.svelte'
    import type { CompanyNameVariants, NumberedShareNames } from './companyPresentation.js'
    import { spreadsheetCompanies } from './spreadsheetCompanies.js'
    import OwnershipSpreadsheet from './OwnershipSpreadsheet.svelte'
    import { ClassicTileAppearance, MutedTileAppearance } from '../tiles/tileAppearance.js'
    import TrackTilePicker from '../maps/TrackTilePicker.svelte'
    import PlayersPanel from './PlayersPanel.svelte'
    import type { GameAction } from '@tabletop/common'
    import type { HistoryDescription } from './historyDescription.js'
    import History from './History.svelte'
    import TableHeader from './TableHeader.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import PhaseChart from '../phases/PhaseChart.svelte'
    import PhaseChartContent from '../phases/PhaseChartContent.svelte'
    import type { PhaseChartData } from '../phases/phaseChart.js'
    let {
        session,
        additionalStockActions = [],
        gameInformation,
        spreadsheetCompanyOrder,
        auctionLotDescription,
        numberedShareLocation,
        actions,
        historyDescription,
        privateOperationDescription
    }: {
        session: EighteenXXSession
        additionalStockActions?: readonly StockMenuOption[]
        gameInformation?: Snippet
        spreadsheetCompanyOrder?: readonly string[]
        auctionLotDescription?: (id: string) => string
        numberedShareLocation?: (companyId: string, number: number) => string | undefined
        actions: Snippet<[(locationId: string) => void, (trainId: string) => void]>
        historyDescription?: (
            action: GameAction,
            companyName: (id: string) => string
        ) => HistoryDescription | undefined
        privateOperationDescription: (
            privateCompanyId: string,
            companyId: string
        ) => string | undefined
    } = $props()
    const money = $derived(session.presentation.money)
    const {
        marketPoolId,
        exchangePoolId,
        companyNames,
        companyPricePresentation = DefaultCompanyPricePresentation,
        includedCompanyIds = [],
        numberedShareNames,
        mapFocusExcludedCompanyIds = [],
        poolName,
        trainColors,
        phaseColors,
        phaseChart,
        portfolioCompanyIds = [],
        includedPortfolioCompanyIds = [],
        privatePurchaseLabel = 'Buy privates'
    } = $derived(session.presentation)
    const operatingRules = $derived(session.operatingRules)
    const valuationRules = $derived(session.valuationRules)
    const phaseTileColors = $derived(
        Object.fromEntries(session.phases.phases.map((phase) => [phase.id, phase.tileColors]))
    )
    const readOnlyPosition = $derived(
        session.isViewingHistory || !session.myPlayer || !session.isMyTurn
    )
    let showDepot = $state(false)
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
    const tileAppearance = $derived(
        (publishedArtwork ? session.mapView.publishedTileAppearance : undefined) ??
            (session.map.style === 'muted' ? MutedTileAppearance : ClassicTileAppearance)
    )
    function paintBodyBackground(_table: HTMLElement, initialColor: string | undefined) {
        const original = document.body.style.backgroundColor
        function paint(color: string | undefined) {
            document.body.style.backgroundColor = color ?? original
        }
        paint(initialColor)
        return { update: paint, destroy: () => paint(undefined) }
    }
    async function toggleArtwork() {
        session.toggleArtwork()
        restoreRouteView = undefined
        await tick()
        mapWrapper?.fitToContent()
    }

    let mapWrapper = $state<ScalingWrapper>()
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
        selectedView = 'Map'
        session.map.inspect({ kind: 'hex', locationId })
        await tick()
        if (restore) {
            mapWrapper?.fitToContent({ animate: true })
            return
        }
        const scene = session.map.displayedScene
        mapWrapper?.focusRect(
            mapSelectionRect(scene, { kind: 'hex', locationId }, 140, 220, boardArtwork),
            {
                animate: true
            }
        )
    }
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
        selectedView = 'Map'
        await tick()
        if (restore) {
            mapWrapper?.fitToContent({ animate: true })
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
        const route = session.routes.solved?.result.routes.find(
            (route) => route.trainId === trainId
        )
        if (!route) return
        const restore = focusedRoute === trainId
        focusedRoute = restore ? undefined : trainId
        focusedLocation = undefined
        focusedCompany = undefined
        selectedView = 'Map'
        await tick()
        if (restore) {
            mapWrapper?.fitToContent({ animate: true })
            return
        }
        focusLocations([...new Set(route.paths.map((path) => path.locationId))])
    }
    function previewHistoryMap(action: GameAction) {
        session.previewHistoryMap(action)
    }
    const displayedScene = $derived(session.map.displayedScene)
    function focusLocations(locations: readonly string[], animate = true) {
        const rectangles = locations.map((locationId) =>
            mapSelectionRect(displayedScene, { kind: 'hex', locationId }, 140, 220, boardArtwork)
        )
        const x = Math.min(...rectangles.map((rect) => rect.x))
        const y = Math.min(...rectangles.map((rect) => rect.y))
        const right = Math.max(...rectangles.map((rect) => rect.x + rect.width))
        const bottom = Math.max(...rectangles.map((rect) => rect.y + rect.height))
        mapWrapper?.focusRect({ x, y, width: right - x, height: bottom - y }, { animate })
    }
    const consentPreview = $derived(session.gameState.trackConsent)
    const maskPlacementLocations = $derived(
        !consentPreview &&
            (session.track.showChoices || session.gameState.machineState === 'PlacingStation')
    )
    const placementLocationIds = $derived(
        !session.privateActions.trackPowerSelection && session.stations.canPlace
            ? session.stations.locationIds
            : session.track.locationIds
    )
    const highlightedPlacementLocationIds = $derived(
        session.track.showChoices
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
            selectedView = 'Map'
            void tick().then(() => {
                if (current === request) focusLocations(locations)
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
        !session.isViewingHistory && session.gameState.machineState === 'RunningTrains'
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
            selectedView = 'Map'
            void tick().then(() => {
                if (current !== request) return
                const locations = preview.result.routes.flatMap((route) =>
                    route.paths.map((path) => path.locationId)
                )
                restoreRouteView ??= mapWrapper?.captureView()
                focusLocations([...new Set(locations)])
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
            returnTo ??= { view, restore: mapWrapper?.captureView() }
            session.closeHistoricalMap()
            selectedView = 'Map'
            void tick().then(() => {
                if (current !== request) return
                const locations = companyFocusLocations(
                    session.stations.displayState,
                    selected.companyId
                )
                if (locations.length) focusLocations(locations)
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
        const context = session.history.visibleContext
        return historyMapFocus(context.state, context.actions.at(-1))
    })
    const historyMapSettled = $derived(
        !session.updatingVisibleState &&
            session.history.visibleContext.state.actionCount === session.gameState.actionCount
    )
    const mapRoutes = $derived(
        !historyMapSettled
            ? []
            : historicalFocus
              ? historicalFocus.routes.map((route, index) => ({
                    id: route.trainId,
                    color: routeColor(index),
                    segments: route.paths
                }))
              : session.routes.overlays
    )
    const mapMask = $derived.by(
        ():
            | { legalLocationIds: readonly string[]; highlightedLocationIds: readonly string[] }
            | undefined => {
            if (session.isViewingHistory)
                return mapRoutes.length
                    ? { legalLocationIds: [], highlightedLocationIds: routeLocationIds(mapRoutes) }
                    : undefined
            if (maskPlacementLocations)
                return {
                    legalLocationIds: placementLocationIds,
                    highlightedLocationIds: highlightedPlacementLocationIds
                }
            if (routePreview && !session.routes.editor.trainId && mapRoutes.length)
                return { legalLocationIds: [], highlightedLocationIds: routeLocationIds(mapRoutes) }
            return undefined
        }
    )
    const settledHistoricalFocus = $derived(
        historyMapSettled && mapWrapper ? historicalFocus : undefined
    )
    function frameHistory(_table: HTMLElement, initial: typeof settledHistoricalFocus) {
        let request = 0
        function frame(target: typeof settledHistoricalFocus) {
            const current = ++request
            if (!target) return
            void tick().then(() => {
                if (current !== request) return
                if (target.locations.length) focusLocations(target.locations, false)
                else mapWrapper?.fitToContent()
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
    const startedCompanies = $derived(
        spreadsheetCompanies(
            gameState,
            session.actions,
            session.gameState.actionCount,
            spreadsheetCompanyOrder,
            includedCompanyIds
        )
    )
    const headerState = $derived(tableHeaderState(session))
    const headerPlayerId = $derived(
        headerState.activePlayerIds.length === 1 ? headerState.activePlayerIds[0] : undefined
    )
    const operating = $derived(gameState.stockRound.completed && !!gameState.operatingSet)
    const operatingCompanyId = $derived(
        operating && !gameState.result ? nextOperatingCompany(gameState) : undefined
    )
    const companyOrder = $derived(
        (operating && gameState.operatingSet
            ? gameState.operatingSet.companyOrder
            : operatingRules.companyOrder(gameState)
        ).map((id) => getCompany(gameState, id))
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
    const paneLayout = new MediaQuery('(min-width: 64rem)')
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
    let sidebar: HTMLDivElement
    let selectedView = $state('Map')
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
        { id: 'Game info', label: 'Game info' },
        ...sidebarViews.map((id) => ({ id, label: id }))
    ]

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
            if (paneLayout.current) {
                event.preventDefault()
                selectedView = sidebarViews[sidebarIndex]
                return
            }
            const tab = sidebar.querySelectorAll<HTMLButtonElement>('[role="tab"]')[sidebarIndex]
            if (tab) {
                event.preventDefault()
                tab.click()
            }
        }
    }
</script>

<svelte:window onkeydown={navigateByShortcut} />

{#snippet playerCards()}<PlayersPanel
        {companyNames}
        {session}
        {valuationRules}
        {auctionLotDescription}
        {numberedShareNames}
        {numberedShareLocation}
        onFocusLocation={focusLocation}
        {mapFocusExcludedCompanyIds}
        onFocusCompany={focusCompany}
        {portfolioCompanyIds}
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
        {phaseColors}
        {phaseTileColors}
        {companyNames}
        describeAction={historyDescription}
    />{/snippet}

{#snippet historyControls(bordered = true)}
    <HistoryControls
        borderClass={bordered ? 'border-b border-[var(--rail-border,#b8a995)]' : ''}
        enabledColor="text-[var(--rail-text,#695540)]"
        disabledColor="text-[var(--rail-inactive,#b9ae9f)]"
        bgClass="bg-transparent"
    />
{/snippet}

{#snippet sidebarInformation()}
    <div class="game-information" aria-label="Game information">
        <button
            class="game-information-item depot-information phase-information"
            onclick={() => (showPhaseChart = true)}
            aria-haspopup="dialog"
            aria-label="Open phase chart"
        >
            <span class="information-label">Phase</span>
            <TrainBadge
                name={session.gameState.phaseId}
                color={trainColors[session.gameState.phaseId]}
            />
        </button>
        <div class="game-information-item">
            <span class="information-label train-limit-label">Train limit</span>
            <span class="train-limit-value"
                >{phaseChart.phases.find((phase) => phase.id === session.gameState.phaseId)
                    ?.trainLimit}</span
            >
        </div>
        <button
            class="game-information-item depot-information"
            onclick={() => (showDepot = true)}
            aria-haspopup="dialog"
            aria-label="Open depot"
        >
            <span class="information-label">Depot</span>
            {#each currentDepotIds as currentDepotId (currentDepotId)}
                {@const remaining = session.trainDepot.remaining(
                    session.gameState.trainInventory,
                    currentDepotId
                )}
                <span class="depot-type"
                    ><TrainBadge
                        name={session.trainShortLabel(currentDepotId)}
                        color={trainColors[currentDepotId]}
                    />
                    <span class="depot-count"
                        >{remaining === 'unlimited' ? '∞' : `×${remaining}`}</span
                    ></span
                >
            {:else}<span>Empty</span>{/each}
        </button>
    </div>
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
{#snippet sidebarTabs()}
    <div bind:this={sidebar} style="display: contents">
        <DefaultTabs
            chat={chatPanel}
            history={historyPanel}
            playersPanel={playerCards}
            fontClass="railway-tab-label"
            contentClass="p-0 mt-0 has-[.round-history]:-mt-1 h-full overflow-auto rounded-none bg-transparent dark:bg-transparent"
            activeTabClass="py-2 px-2 text-[var(--rail-text,#5e4937)] rounded-none"
            inactiveTabClass="py-2 px-2 text-[var(--rail-inactive,#998b79)] hover:text-[var(--rail-text,#5e4937)] rounded-none"
        ></DefaultTabs>
    </div>
{/snippet}

<div
    class="railway-table"
    class:published-artwork={publishedArtwork}
    use:paintBodyBackground={boardArtwork?.backgroundColor}
    use:framePlacement={activePlacementFocusKey}
    use:frameRoutes={{ runningCompanyId, preview: routePreview }}
    use:frameStartCompany={session.stock.selectedStartCompany}
    use:frameHistory={settledHistoricalFocus}
    style:--rail-table-background={boardArtwork?.backgroundColor}
    style:--rail-map-background={boardArtwork?.backgroundColor}
    style:--table-header-offset="calc(var(--app-navbar-height, 0px) + {session.isViewingHistory
        ? 14
        : 0}px)"
    data-theme="dark"
    aria-label="Game table"
    aria-busy={!session.preferences.ready}
>
    {#if session.preferences.ready && layoutPreference.ready}
        {#if session.isViewingHistory}
            <div class="history-strip" role="status"><span>VIEWING HISTORY</span></div>
        {/if}
        <div class="table-layout" style:--app-navbar-height="var(--table-header-offset)">
            <DefaultTableLayout
                topPadding={0}
                horizontalPadding={paneLayout.current ? 0 : 8}
                showSidebar={!paneLayout.current}
            >
                {#snippet mobileControlsContent()}
                    {@render historyControls()}
                {/snippet}
                {#snippet sideContent()}
                    <div class="max-sm:hidden">{@render historyControls()}</div>
                    {@render sidebarInformation()}
                    {@render sidebarTabs()}
                {/snippet}
                {#snippet gameContent()}
                    <div
                        class:workspace-heading={paneLayout.current}
                        class:player-tinted-header={paneLayout.current && !!headerPlayerId}
                        style:--player-color={headerPlayerId
                            ? session.colors.getPlayerBgColorValue(headerPlayerId)
                            : undefined}
                    >
                        {#if paneLayout.current}<div class="workspace-history-controls">
                                {@render historyControls(false)}
                            </div>{/if}
                        <div class="table-heading">
                            <TableHeader
                                artworkAvailable={session.publishedArtworkAvailable}
                                {publishedArtwork}
                                onToggleArtwork={toggleArtwork}
                                {session}
                                {phaseChart}
                                {trainColors}
                                {companyNames}
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
                                    <CompanyOrderToggle
                                        showDetails={session.preferences.values
                                            .operatingOrderDisplay === 'details'}
                                        onDisplayChange={(details) =>
                                            session.preferences.set(
                                                {
                                                    operatingOrderDisplay: details
                                                        ? 'details'
                                                        : 'tokens'
                                                },
                                                'family'
                                            )}
                                    />
                                </div>
                                <CompanyOrder
                                    {money}
                                    showDetails={session.preferences.values
                                        .operatingOrderDisplay === 'details'}
                                    companies={companyOrder}
                                    state={gameState}
                                    trainDepot={session.trainDepot}
                                    {trainColors}
                                    requiresTrain={(companyId) =>
                                        session.companyRequiresTrain(companyId)}
                                    appearances={session.mapView.stations}
                                    completedCompanyIds={operating
                                        ? gameState.operatingSet?.completedCompanyIds
                                        : []}
                                    currentCompanyId={operatingCompanyId}
                                >
                                    {#snippet companyDetails(company)}
                                        <CompanyDetails
                                            pricePresentation={companyPricePresentation}
                                            onPreviewMap={previewHistoryMap}
                                            {trainColors}
                                            {session}
                                            {company}
                                            {poolName}
                                            {privateOperationDescription}
                                        />
                                    {/snippet}
                                </CompanyOrder>
                            </div>
                        {/if}
                    {/snippet}
                    {#snippet actionContent()}
                        <div class="action-body">
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
                            {/if}
                            <section class="action-panel" aria-label="Current action">
                                {#if readOnlyPosition}
                                    <PositionPanel
                                        {session}
                                        {trainColors}
                                        describeAction={historyDescription}
                                    />
                                {:else}
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
                                    currentPhaseId={headerState.phaseId}
                                    {trainColors}
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
                                />
                            </div>
                        {:else if id === 'Players'}<div class="workspace-view players-pane">
                                {@render playerCards()}
                            </div>
                        {:else if id === 'History'}<div class="workspace-view">
                                {@render historyPanel()}
                            </div>
                        {:else if id === 'Chat'}<div class="workspace-view">
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
                            </div>{:else if id === 'Map'}<div class="workspace-view map-area">
                                <ScalingWrapper
                                    bind:this={mapWrapper}
                                    maxScale={2}
                                    onManualViewChange={() => {
                                        restoreRouteView = undefined
                                    }}
                                    justify="center"
                                    controls="bottom-left"
                                    expandable={true}
                                >
                                    <MapScene
                                        revenueStageColors={session.mapView.revenueStageColors}
                                        scene={displayedScene}
                                        artwork={boardArtwork}
                                        tokens={session.map.displayedTokens}
                                        reservations={session.track.displayedPreview
                                            ?.stationReservations ??
                                            session.stations.displayState.stationReservations}
                                        routes={mapRoutes}
                                        selection={session.isViewingHistory
                                            ? historyMapSettled
                                                ? historicalFocus?.selection
                                                : undefined
                                            : session.map.selection}
                                        maskUnavailableLocations={!!mapMask}
                                        legalLocationIds={mapMask?.legalLocationIds}
                                        highlightedLocationIds={mapMask?.highlightedLocationIds}
                                        previewLocationId={session.track.displayedPreview
                                            ?.locationId ??
                                            session.stations.preview?.position.locationId}
                                        translucentLocationId={consentPreview?.details.locationId}
                                        appearance={tileAppearance}
                                        hexDiameter={140}
                                        onselect={consentPreview
                                            ? undefined
                                            : (selection) => session.map.select(selection, false)}
                                    />
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
                            </div>{:else if id === 'Market'}<div class="workspace-view market-area">
                                <ScalingWrapper
                                    justify="center"
                                    controls="bottom-left"
                                    expandable={true}
                                    allowFullscreenShortcut={() => !mapWrapper?.isVisible()}
                                >
                                    <StockMarketScene
                                        animation={session.marketAnimation}
                                        appearances={session.mapView.stations}
                                        renderScale={2}
                                        market={session.gameState.stockMarket}
                                        companies={session.gameState.companies}
                                    />
                                </ScalingWrapper>
                            </div>{:else if id === 'Spreadsheet'}<div
                                class="workspace-view data-area"
                            >
                                <OwnershipSpreadsheet
                                    pricePresentation={companyPricePresentation}
                                    fillWidth={paneLayout.current}
                                    {includedPortfolioCompanyIds}
                                    companyOrder={spreadsheetCompanyOrder}
                                    onPreviewMap={previewHistoryMap}
                                    {trainColors}
                                    {valuationRules}
                                    {session}
                                    {companyNames}
                                    {marketPoolId}
                                    {exchangePoolId}
                                    {portfolioCompanyIds}
                                />
                            </div>{:else if id === 'Companies'}<div class="workspace-view">
                                <CompanyCardLayout
                                    paned={paneLayout.current}
                                    itemCount={startedCompanies.length}
                                >
                                    {#each startedCompanies as company (company.id)}
                                        <CompanyDetails
                                            pricePresentation={companyPricePresentation}
                                            vertical
                                            displayName={companyNames?.[company.id]?.card}
                                            {company}
                                            {session}
                                            {trainColors}
                                            {poolName}
                                            {privateOperationDescription}
                                            onPreviewMap={previewHistoryMap}
                                        />
                                    {:else}<p class="widget-empty">
                                            No companies have started.
                                        </p>{/each}
                                </CompanyCardLayout>
                            </div>{:else if id === 'Tiles'}<div class="workspace-view">
                                <TileManifest
                                    tiles={session.mapView.tileSet.definitions}
                                    inventory={session.map.tileCounts}
                                    layouts={session.mapView.layouts}
                                    orientation={session.mapView.map.definition.orientation}
                                    appearance={tileAppearance}
                                />
                            </div>{/if}
                    {/snippet}
                    {#if paneLayout.current}
                        <div class="pane-workspace">
                            <TabWorkspace
                                tabs={paneTabs}
                                savedLayout={restoreTableWorkspace(
                                    layoutPreference.value,
                                    paneTabs
                                )}
                                onLayoutChange={(value) =>
                                    layoutPreference.change(saveTableWorkspace(value))}
                                tabTitle={sidebarTabIcon}
                                bind:selected={selectedView}
                                label="Table views"
                                initialLayout={initialTableLayout}
                                {children}
                            />
                        </div>
                    {:else}
                        <div class="original-actions">{@render actionContent()}</div>
                        <TabWorkspace
                            tabs={workspaceTabs.filter((tab) => tab.id !== 'Actions')}
                            bind:selected={selectedView}
                            label="Table views"
                            splittable={false}
                            {children}
                        />
                    {/if}
                {/snippet}
            </DefaultTableLayout>
        </div>

        {#if showPhaseChart}<PhaseChart
                {money}
                {depotState}
                chart={phaseChart}
                currentPhaseId={session.gameState.phaseId}
                {trainColors}
                onclose={() => (showPhaseChart = false)}
            />{/if}
        {#if showDepot}<PhaseChart
                {money}
                {depotState}
                depotOnly
                chart={phaseChart}
                currentPhaseId={session.gameState.phaseId}
                {trainColors}
                onclose={() => (showDepot = false)}
            />{/if}

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
    .history-strip {
        display: flex;
        flex: none;
        align-items: center;
        justify-content: center;
        height: 14px;
        background: repeating-linear-gradient(135deg, #18212b 0 10px, #f4e8ce 10px 20px);
        color: #18212b;
    }
    .history-strip span {
        padding: 0 12px;
        background: #f4e8ce;
        font-size: 9px;
        font-weight: 800;
        line-height: 14px;
        letter-spacing: 0.16em;
    }
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
    .game-info-pane .depot-information {
        margin-inline: 0;
    }
    .game-info-pane .phase-information {
        padding-left: 0;
    }
    .original-actions {
        --stock-buy-wrap: nowrap;
        --stock-buy-overflow: auto;
        flex: none;
        max-height: 50dvh;
        overflow: auto;
    }
    .original-actions:has(.action-panel :global(.centered-panel)) {
        max-height: none;
        overflow: visible;
    }
    .workspace-view {
        height: 100%;
        min-height: 0;
        min-width: 0;
        overflow: auto;
    }
    .players-pane {
        container: player-pane / size;
        padding: 10px 8px 0;
        box-sizing: border-box;
    }
    .actions-area {
        container: stock-actions / inline-size;
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
    .actions-area .action-panel {
        flex: 1 0 auto;
    }
    .widget-empty {
        padding: 16px;
        color: var(--rail-muted, #887969);
    }
    .order-display {
        display: flex;
        justify-content: flex-end;
    }
    .railway-table {
        --workspace-text: var(--rail-text, #443c34);
        --workspace-muted: var(--rail-muted, #887969);
        --workspace-inactive: var(--rail-inactive, #938371);
        --workspace-border: var(--rail-border, #d2c5b7);
        --workspace-focus: var(--rail-focus, #7c634b);
        --workspace-hover: var(--rail-hover, #69554016);
        --workspace-surface: var(--rail-surface, #faf7f2);
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
        --rail-map-background: #172832;
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
        margin-top: -8px;
        padding: 6px;
        border-bottom: 1px solid var(--rail-border, #b8a995);
        color: var(--rail-text, #514536);
        font-size: 12px;
        line-height: 20px;
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
    .depot-information {
        border: 0;
        padding: 4px 5px;
        margin: -4px -5px;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .depot-information:hover {
        background: var(--rail-hover, #ffffff66);
    }
    .depot-information:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 2px;
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
        text-align: center;
        line-height: 10px;
    }
    .train-limit-value {
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
    @container stock-actions (min-width: 500px) {
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
        background: var(--rail-map-background, #cbdfe8);
        position: relative;
    }
    .map-area,
    .market-area {
        overflow: hidden;
    }
    .data-area {
        padding-bottom: 8px;
    }
</style>
