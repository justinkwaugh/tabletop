<script lang="ts">
    import './playerTint.css'
    import { tableHeaderState } from './tableHeaderState.js'
    import { initialTableLayout, restoreTableWorkspace, saveTableWorkspace } from './tableWorkspace.js'
    import { historyMapFocus } from '../maps/historyMapFocus.js'
    import { routeColor } from '../routes/routePresentation.js'
    import PositionPanel from './PositionPanel.svelte'
    import { companyFocusLocations, companyNetworkFocusLocations } from '../maps/companyFocusLocations.js'
    import {
        FinanceExampleValidator,
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
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import { mapSelectionRect } from '../maps/mapDrawing.js'
    import MapScene from '../maps/MapScene.svelte'
    import HistoricalMapViewer from '../maps/HistoricalMapViewer.svelte'
    import StockMarketScene from '../stock/StockMarketScene.svelte'
    import TileManifest from '../tiles/TileManifest.svelte'
    import type { CompanyNameVariants, NumberedShareNames } from './companyPresentation.js'
    import OwnershipSpreadsheet from './OwnershipSpreadsheet.svelte'
    import { ClassicTileAppearance, MutedTileAppearance } from '../tiles/tileAppearance.js'
    import TrackTilePicker from '../maps/TrackTilePicker.svelte'
    import PlayersPanel from './PlayersPanel.svelte'
    import { assert, type GameAction } from '@tabletop/common'
    import type { HistoryDescription } from './historyDescription.js'
    import History from './History.svelte'
    import TableHeader from './TableHeader.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import PhaseChart from '../phases/PhaseChart.svelte'
    import PhaseChartContent from '../phases/PhaseChartContent.svelte'
    import type { PhaseChartData } from '../phases/phaseChart.js'
    let {
        session,
        marketPoolId,
        additionalStockActions = [],
        gameInformation,
        exchangePoolId,
        companyNames,
        spreadsheetCompanyOrder,
        auctionLotDescription,
        numberedShareNames,
        numberedShareLocation,
        mapFocusExcludedCompanyIds = [],
        actions,
        operatingRules,
        poolName,
        trainColors,
        phaseColors,
        phaseChart,
        phaseTileColors,
        historyDescription,
        valuationRules,
        portfolioCompanyIds = [],
        includedPortfolioCompanyIds = [],
        privatePurchaseLabel = 'Buy privates',
        privateOperationDescription
    }: {
        session: FinanceExampleSession
        additionalStockActions?: readonly StockMenuOption[]
        gameInformation?: Snippet
        marketPoolId: string
        exchangePoolId?: string
        spreadsheetCompanyOrder?: readonly string[]
        companyNames?: Readonly<Record<string, CompanyNameVariants>>
        auctionLotDescription?: (id: string) => string
        numberedShareNames?: NumberedShareNames
        numberedShareLocation?: (companyId: string, number: number) => string | undefined
        mapFocusExcludedCompanyIds?: readonly string[]
        actions: Snippet<[(locationId: string) => void, (trainId: string) => void]>
        operatingRules: OperatingRules
        portfolioCompanyIds?: readonly string[]
        includedPortfolioCompanyIds?: readonly string[]
        valuationRules: ValuationRules
        trainColors: Readonly<Record<string, string>>
        phaseColors: Readonly<Record<string, string>>
        phaseChart: PhaseChartData
        phaseTileColors: Readonly<Record<string, readonly string[]>>
        historyDescription?: (action: GameAction, companyName: (id: string) => string) => HistoryDescription | undefined
        poolName?: (pool: CertificatePool) => string
        privatePurchaseLabel?: string
        privateOperationDescription: (
            privateCompanyId: string,
            companyId: string
        ) => string | undefined
    } = $props()
    const readOnlyPosition = $derived(session.isViewingHistory || !session.myPlayer || !session.isMyTurn)
    let showDepot = $state(false)
    let showPhaseChart = $state(false)
    const depotState = $derived({ depot: session.trainDepot, inventory: session.financialState.trainInventory, availableDefinitionIds: session.availableTrainDefinitionIds })
    const currentDepotIds = $derived(session.availableTrainDefinitionIds.filter((id) => session.trainDepot.remaining(session.financialState.trainInventory, id) !== 0))

    let mapWrapper = $state<ScalingWrapper>()
    let focusedLocation: string | undefined = $derived.by(() => {
        session.financialState
        return undefined
    })
    async function focusLocation(locationId: string) {
        session.closeHistoricalMap()
        focusedRoute = undefined
        focusedCompany = undefined
        const restore = focusedLocation === locationId
        focusedLocation = restore ? undefined : locationId
        selectedView = 'Map'
        session.inspectMap({ kind: 'hex', locationId })
        await tick()
        if (restore) {
            mapWrapper?.fitToContent({ animate: true })
            return
        }
        const scene = session.displayedMapScene
        mapWrapper?.focusRect(mapSelectionRect(scene, { kind: 'hex', locationId }, 140, 220), {
            animate: true
        })
    }
    let focusedCompany: string | undefined = $derived.by(() => {
        session.financialState
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
            new RailwayMapState(session.mapView.map, session.mapView.tileSet, session.financialState.tileInventory),
            session.stationDisplayState,
            companyId
        )
        if (!locations.length) return
        focusLocations(locations)
    }
    let focusedRoute: string | undefined = $derived.by(() => {
        session.financialState
        session.updatingVisibleState
        return undefined
    })
    async function focusRoute(trainId: string) {
        session.closeHistoricalMap()
        const route = session.automaticRouteResult?.result.routes.find((route) => route.trainId === trainId)
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
    const displayedScene = $derived(session.displayedMapScene)
    function focusLocations(locations: readonly string[], animate = true) {
        const rectangles = locations.map((locationId) => mapSelectionRect(
            displayedScene, { kind: 'hex', locationId }, 140, 220
        ))
        const x = Math.min(...rectangles.map((rect) => rect.x))
        const y = Math.min(...rectangles.map((rect) => rect.y))
        const right = Math.max(...rectangles.map((rect) => rect.x + rect.width))
        const bottom = Math.max(...rectangles.map((rect) => rect.y + rect.height))
        mapWrapper?.focusRect({ x, y, width: right - x, height: bottom - y }, { animate })
    }
    const consentPreview = $derived(session.financialState.trackConsent)
    const maskPlacementLocations = $derived(!consentPreview &&
        (session.showTrackChoices || session.financialState.machineState === 'PlacingStation'))
    const placementLocationIds = $derived(!session.privateTrackPowerSelection && session.canPlaceStation
        ? session.stationLocationIds : session.trackLocationIds)
    const highlightedPlacementLocationIds = $derived(session.showTrackChoices
        ? [...new Set([...session.reachableTrackLocationIds, ...placementLocationIds])]
        : placementLocationIds)
    const placementFocusKey = $derived(consentPreview?.id ?? (maskPlacementLocations
        ? JSON.stringify([session.financialState.machineState, highlightedPlacementLocationIds]) : undefined))
    $effect(() => {
        if (session.isViewingHistory || !placementFocusKey || session.updatingVisibleState) return
        return untrack(() => {
            const locations = consentPreview ? [consentPreview.details.locationId] : [...highlightedPlacementLocationIds]
            if (!locations.length) return
            let cancelled = false
            selectedView = 'Map'
            void tick().then(() => {
                if (!cancelled) focusLocations(locations)
            })
            return () => { cancelled = true }
        })
    })
    let restoreRouteView: ReturnType<ScalingWrapper['captureView']> | undefined
    const runningCompanyId = $derived(!session.isViewingHistory && session.financialState.machineState === 'RunningTrains'
        ? session.financialState.routeStep?.companyId : undefined)
    $effect(() => {
        if (!runningCompanyId) return
        return () => {
            const restore = restoreRouteView
            restoreRouteView = undefined
            if (!session.isViewingHistory) restore?.({ animate: true })
        }
    })
    $effect(() => {
        const preview = session.automaticRouteResult
        if (session.isViewingHistory || !preview?.result.routes.length) return
        let cancelled = false
        untrack(() => {
            focusedRoute = undefined
            focusedLocation = undefined
            focusedCompany = undefined
            selectedView = 'Map'
            void tick().then(() => {
                if (cancelled) return
                const locations = preview.result.routes.flatMap((route) =>
                    route.paths.map((path) => path.locationId)
                )
                restoreRouteView ??= mapWrapper?.captureView()
                focusLocations([...new Set(locations)])
            })
        })
        return () => { cancelled = true }
    })
    $effect(() => {
        const selected = session.selectedStartCompany
        if (!selected) return
        return untrack(() => {
            const previousView = view
            const restore = mapWrapper?.captureView()
            let cancelled = false
            session.closeHistoricalMap()
            selectedView = 'Map'
            void tick().then(() => {
                if (cancelled) return
                const locations = companyFocusLocations(session.stationDisplayState, selected.companyId)
                if (locations.length) focusLocations(locations)
            })
            return () => {
                cancelled = true
                if (session.busy || session.updatingVisibleState || session.isViewingHistory) return
                selectedView = previousView
                void tick().then(() => restore?.({ animate: true }))
            }
        })
    })

    const historicalFocus = $derived.by(() => {
        if (!session.isViewingHistory) return undefined
        const context = session.history.visibleContext
        assert(FinanceExampleValidator.Check(context.state), 'History map focus requires financial state')
        return historyMapFocus(context.state, context.actions.at(-1))
    })
    const historyMapSettled = $derived(!session.updatingVisibleState &&
        session.history.visibleContext.state.actionCount === session.gameState.actionCount)
    const mapRoutes = $derived(!historyMapSettled ? [] : historicalFocus
        ? historicalFocus.routes.map((route, index) => ({
            id: route.trainId, color: routeColor(index), segments: route.paths
        }))
        : session.routeOverlays)
    $effect(() => {
        const target = historicalFocus
        if (!target || !historyMapSettled || !mapWrapper) return
        return untrack(() => {
            let cancelled = false
            void tick().then(() => {
                if (cancelled) return
                if (target.locations.length) focusLocations(target.locations, false)
                else mapWrapper?.fitToContent()
            })
            return () => { cancelled = true }
        })
    })

    const financialState = $derived(session.financialState)
    const headerState = $derived(tableHeaderState(session))
    const headerPlayerId = $derived(headerState.activePlayerIds.length === 1 ? headerState.activePlayerIds[0] : undefined)
    const operating = $derived(financialState.stockRound.completed && !!financialState.operatingSet)
    const operatingCompanyId = $derived(operating && !financialState.result ? nextOperatingCompany(financialState) : undefined)
    const companyOrder = $derived(
        (operating && financialState.operatingSet
            ? financialState.operatingSet.companyOrder
            : operatingRules.companyOrder(financialState)
        ).map((id) => getCompany(financialState, id))
    )
    setGameSession(untrack(() => session))
    const layoutPreference = new DebouncedLayout(
        () => ({ ready: session.preferences.ready, key: session.preferences.storageKey('family'), value: session.preferences.values.paneLayout }),
        value => session.preferences.save({ paneLayout: value }, 'family')
    )
    const paneLayout = new MediaQuery('(min-width: 64rem)')
    const views = ['Map', 'Market', 'Spreadsheet', 'Tiles', 'Player Aid', 'Actions'] as const
    const sidebarViews = ['Players', 'History', 'Chat']
    let sidebar: HTMLDivElement
    let selectedView = $state('Map')
    const view = $derived(selectedView)
    const workspaceTabs = views.map(id => ({ id, label: id, closable: id !== 'Actions', ...(id === 'Spreadsheet' ? { shortLabel: 'Sheet' } : {}) }))
    const paneTabs = [...workspaceTabs, { id: 'Depot', label: 'Depot', optional: true }, { id: 'Operating Order', label: 'Operating Order', optional: true }, { id: 'Game info', label: 'Game info' }, ...sidebarViews.map(id => ({ id, label: id }))]

    function navigateByShortcut(event: KeyboardEvent) {
        if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
        const target = event.target
        if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"], [role="dialog"]'))) return
        const key = event.key.toLowerCase()
        const viewIndex = ['m', 'k', 's', 't', 'a'].indexOf(key)
        if (viewIndex >= 0) {
            event.preventDefault()
            selectedView = ['Map', 'Market', 'Spreadsheet', 'Tiles', 'Actions'][viewIndex]
            return
        }
        const sidebarIndex = ['p', 'h', 'c'].indexOf(key)
        if (sidebarIndex >= 0) {
            if (paneLayout.current) { event.preventDefault(); selectedView = sidebarViews[sidebarIndex]; return }
            const tab = sidebar.querySelectorAll<HTMLButtonElement>('[role="tab"]')[sidebarIndex]
            if (tab) {
                event.preventDefault()
                tab.click()
            }
        }
    }

</script>

<svelte:window onkeydown={navigateByShortcut} />

                {#snippet playerCards()}<PlayersPanel {companyNames}
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
            {#if id === 'Players'}<path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6m-5 11a5 5 0 0 1 10 0Z" />
            {:else if id === 'History'}<circle cx="10" cy="10" r="9"/><path d="M10 4v6l4 2" fill="none" stroke="var(--rail-surface,#faf7f2)" stroke-width="1.5"/>
            {:else}<path d="M2 2h16v12h-7l-5 4v-4H2Z"/>{/if}
        </svg>
        {#if id === 'Chat' && session.hasUnreadMessages}<span class="unread-chat" aria-hidden="true"></span>{/if}
    {/if}
{/snippet}

{#snippet historyPanel()}<History onPreviewMap={previewHistoryMap} {session} {trainColors} {phaseColors} {phaseTileColors} {companyNames} describeAction={historyDescription} />{/snippet}

{#snippet historyControls(bordered = true)}
    <HistoryControls
        borderClass={bordered ? "border-b border-[var(--rail-border,#b8a995)]" : ""}
        enabledColor="text-[var(--rail-text,#695540)]"
        disabledColor="text-[var(--rail-inactive,#b9ae9f)]"
        bgClass="bg-transparent"
    />
{/snippet}

{#snippet sidebarInformation()}
            <div class="game-information" aria-label="Game information">
                <button class="game-information-item depot-information phase-information" onclick={() => showPhaseChart = true} aria-haspopup="dialog" aria-label="Open phase chart">
                    <span class="information-label">Phase</span>
                    <TrainBadge name={session.financialState.phaseId} color={trainColors[session.financialState.phaseId]} />
                </button>
                <div class="game-information-item">
                    <span class="information-label train-limit-label">Train limit</span>
                    <span class="train-limit-value">{phaseChart.phases.find((phase) => phase.id === session.financialState.phaseId)?.trainLimit}</span>
                </div>
                <button class="game-information-item depot-information" onclick={() => showDepot = true} aria-haspopup="dialog" aria-label="Open depot">
                    <span class="information-label">Depot</span>
                    {#each currentDepotIds as currentDepotId (currentDepotId)}
                        {@const remaining = session.trainDepot.remaining(session.financialState.trainInventory, currentDepotId)}
                        {@const trainName = session.trainDepot.trainDefinition(currentDepotId).name}
                        <span class="depot-type"><TrainBadge name={trainName === 'Diesel' ? 'D' : trainName} color={trainColors[currentDepotId]} />
                        <span class="depot-count">{remaining === 'unlimited' ? '∞' : `×${remaining}`}</span></span>
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
            <DefaultTabs chat={chatPanel}
                history={historyPanel}
                playersPanel={playerCards}
                fontClass="railway-tab-label"
                contentClass="p-0 mt-0 has-[.round-history]:-mt-1 h-full overflow-auto rounded-none bg-transparent dark:bg-transparent"
                activeTabClass="py-2 px-2 text-[var(--rail-text,#5e4937)] rounded-none"
                inactiveTabClass="py-2 px-2 text-[var(--rail-inactive,#998b79)] hover:text-[var(--rail-text,#5e4937)] rounded-none"
            >

            </DefaultTabs>
            </div>
{/snippet}

<div class="railway-table" data-theme={session.preferences.ready ? session.preferences.values.theme : 'dark'} aria-label="Game table" aria-busy={!session.preferences.ready}>
    {#if session.preferences.ready && layoutPreference.ready}
    <DefaultTableLayout topPadding={0} horizontalPadding={paneLayout.current ? 0 : 8} showSidebar={!paneLayout.current}>
        {#snippet mobileControlsContent()}
            {@render historyControls()}
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">{@render historyControls()}</div>
            {@render sidebarInformation()}
            {@render sidebarTabs()}
        {/snippet}
        {#snippet gameContent()}
            <div class:workspace-heading={paneLayout.current}
                class:player-tinted-header={paneLayout.current && !!headerPlayerId}
                style:--player-color={headerPlayerId ? session.colors.getPlayerBgColorValue(headerPlayerId) : undefined}>
                {#if paneLayout.current}<div class="workspace-history-controls">{@render historyControls(false)}</div>{/if}
                <div class="table-heading"><TableHeader {session} {phaseChart} {trainColors} {companyNames} bordered={!paneLayout.current} /></div>
            </div>
            {#if paneLayout.current && layoutPreference.status}
                <button class="layout-save" disabled={layoutPreference.status === 'saving' || layoutPreference.status === 'saved'} onclick={() => layoutPreference.save()} title="Layout saves automatically after three seconds without changes. Click to save now.">
                    {layoutPreference.status === 'unsaved' ? 'Layout unsaved' : layoutPreference.status === 'saving' ? 'Saving…' : layoutPreference.status === 'error' ? 'Layout not saved · Retry' : 'Saved'}
                </button>
            {/if}
            {#snippet operatingOrderContent()}
            {#if operating && !financialState.result && companyOrder.length}
            <div class="operating-order-footer">
            <div class="order-display">
                <CompanyOrderToggle
                    showDetails={session.preferences.values.operatingOrderDisplay === 'details'}
                onDisplayChange={(details) =>
                    session.preferences.set(
                        { operatingOrderDisplay: details ? 'details' : 'tokens' },
                        'family'
                    )}
                />
            </div>
            <CompanyOrder
                showDetails={session.preferences.values.operatingOrderDisplay === 'details'}
                companies={companyOrder}
                state={financialState}
                trainDepot={session.trainDepot}
                {trainColors}
                requiresTrain={(companyId) => session.companyRequiresTrain(companyId)}
                appearances={session.mapView.stations}
                completedCompanyIds={operating
                    ? financialState.operatingSet?.completedCompanyIds
                    : []}
                currentCompanyId={operatingCompanyId}
            >
                {#snippet companyDetails(company)}
                    <CompanyDetails
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
            <OperatingSteps {session} {privatePurchaseLabel} readOnly={readOnlyPosition} />
            {#if !readOnlyPosition}
            <StockActionStrip {session} additionalActions={additionalStockActions} />
            {/if}
            <section class="action-panel" aria-label="Current action">
                {#if readOnlyPosition}
                    <PositionPanel {session} {trainColors} describeAction={historyDescription} />
                {:else}
                    {@render actions(focusLocation, focusRoute)}
                {/if}
            </section>
            </div>
            {#if !paneLayout.current}{@render operatingOrderContent()}{/if}
            {/snippet}
            {#snippet children(id: string, active: boolean)}
                    {#if id === 'Game info'}<div class="workspace-view game-info-pane">{@render sidebarInformation()}</div>
                    {:else if id === 'Player Aid'}<div class="workspace-view"><PhaseChartContent {depotState} chart={phaseChart} currentPhaseId={headerState.phaseId} {trainColors} /></div>
                    {:else if id === 'Depot'}<div class="workspace-view"><PhaseChartContent {depotState} depotOnly chart={phaseChart} currentPhaseId={session.financialState.phaseId} {trainColors} /></div>
                    {:else if id === 'Players'}<div class="workspace-view players-pane">{@render playerCards()}</div>
                    {:else if id === 'History'}<div class="workspace-view">{@render historyPanel()}</div>
                    {:else if id === 'Chat'}<div class="workspace-view">{#if active}{@render chatPanel()}{/if}</div>
                    {:else if id === 'Operating Order'}<div class="workspace-view">{@render operatingOrderContent()}{#if !operating || financialState.result || !companyOrder.length}<p class="widget-empty">No operating order this round.</p>{/if}</div>
                    {:else if id === 'Actions'}<div class="workspace-view actions-area">{@render actionContent()}</div>{:else if id === 'Map'}<div class="workspace-view map-area">
                    <ScalingWrapper
                        bind:this={mapWrapper}
                        maxScale={2}
                        onManualViewChange={() => { restoreRouteView = undefined }}
                        justify="center"
                        controls="bottom-left"
                        expandable={true}
                    >
                        <MapScene revenueStageColors={session.mapView.revenueStageColors}
                            scene={displayedScene}
                            tokens={session.displayedMapTokens}
                            reservations={session.displayedTrackPreview?.stationReservations ??
                                session.stationDisplayState.stationReservations}
                            routes={mapRoutes}
                            selection={session.isViewingHistory
                                ? historyMapSettled ? historicalFocus?.selection : undefined
                                : session.mapSelection}
                            maskUnavailableLocations={!session.isViewingHistory && maskPlacementLocations}
                            legalLocationIds={placementLocationIds}
                            highlightedLocationIds={highlightedPlacementLocationIds}
                            previewLocationId={session.displayedTrackPreview?.locationId ??
                                session.stationPreview?.position.locationId}
                            translucentLocationId={consentPreview?.details.locationId}
                            appearance={session.mapStyle === 'muted'
                                ? MutedTileAppearance
                                : ClassicTileAppearance}
                            hexDiameter={140}
                            onselect={consentPreview ? undefined : (selection) => session.selectMap(selection, false)}
                        />
                        {#snippet overlay(viewport)}
                            {#if active && session.canBuildTrack && session.trackSelection.locationId}
                                <TrackTilePicker {session} {viewport} />
                            {/if}
                        {/snippet}
                    </ScalingWrapper>
                    </div>{:else if id === 'Market'}<div class="workspace-view market-area">
                    <ScalingWrapper justify="center" controls="bottom-left" expandable={true} allowFullscreenShortcut={() => !mapWrapper?.isVisible()}>
                        <StockMarketScene
                            animation={session.marketAnimation}
                            appearances={session.mapView.stations}
                            renderScale={2}
                            market={session.financialState.stockMarket}
                            companies={session.financialState.companies}
                        />
                    </ScalingWrapper>
                    </div>{:else if id === 'Spreadsheet'}<div class="workspace-view data-area">
                    <OwnershipSpreadsheet
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
                    </div>{:else if id === 'Tiles'}<div class="workspace-view">
                    <TileManifest
                        tiles={session.mapView.tileSet.definitions}
                        inventory={session.tileCounts}
                        layouts={session.mapView.layouts}
                        orientation={session.mapView.map.definition.orientation}
                        appearance={session.mapStyle === 'muted'
                            ? MutedTileAppearance
                            : ClassicTileAppearance}
                    />
                    </div>{/if}
                {/snippet}
            {#if paneLayout.current}
                <div class="pane-workspace"><TabWorkspace tabs={paneTabs} savedLayout={restoreTableWorkspace(layoutPreference.value, paneTabs)} onLayoutChange={value => layoutPreference.change(saveTableWorkspace(value))} tabTitle={sidebarTabIcon} bind:selected={selectedView} label="Table views" initialLayout={initialTableLayout} {children} /></div>
            {:else}
                <div class="original-actions">{@render actionContent()}</div>
                <TabWorkspace tabs={workspaceTabs.filter(tab => tab.id !== 'Actions')} bind:selected={selectedView} label="Table views" splittable={false} {children} />
            {/if}
        {/snippet}
    </DefaultTableLayout>

{#if showPhaseChart}<PhaseChart {depotState} chart={phaseChart} currentPhaseId={session.financialState.phaseId} {trainColors} onclose={() => showPhaseChart = false} />{/if}
{#if showDepot}<PhaseChart {depotState} depotOnly chart={phaseChart} currentPhaseId={session.financialState.phaseId} {trainColors} onclose={() => showDepot = false} />{/if}

{#if session.historicalMap}
    <HistoricalMapViewer preview={session.historicalMap}
        revenueStageColors={session.mapView.revenueStageColors}
        appearance={session.mapStyle === 'muted' ? MutedTileAppearance : ClassicTileAppearance}
        onclose={() => session.closeHistoricalMap()} />
{/if}
    {/if}
</div>

<style>
    .layout-save { align-self: flex-end; flex: none; border: 0; background: transparent; color: var(--rail-muted, #887969); font-size: 11px; padding: 2px 8px; cursor: pointer; }
    .unread-chat { width: 7px; height: 7px; border-radius: 50%; background: #f43f5e; }
    .pane-workspace { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .workspace-heading { padding-inline: 8px; display: flex; flex: none; align-items: center; gap: 8px; border-bottom: 1px solid var(--rail-border, #b8a995); }
    .workspace-history-controls { width: 320px; flex: none; }
    .table-heading { flex: 1; min-width: 0; }
    .game-info-pane { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; box-sizing: border-box; }
    .game-info-pane .game-information { padding-inline: 8px; }
    .game-info-pane .depot-information { margin-inline: 0; }
    .game-info-pane .phase-information { padding-left: 0; }
    .original-actions { flex: none; max-height: 50dvh; overflow: auto; }
    .workspace-view { height: 100%; min-height: 0; min-width: 0; overflow: auto; }
    .players-pane { container: player-pane / size; padding: 10px 8px 0; box-sizing: border-box; }
    .actions-area { display: flex; flex-direction: column; overflow: hidden; }
    .actions-area .action-body { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: auto; }
    .actions-area .action-panel { flex: 1 0 auto; }
    .widget-empty { padding: 16px; color: var(--rail-muted, #887969); }
    .order-display { display: flex; justify-content: flex-end; }
    .railway-table {
        color-scheme: light;
        --workspace-text: var(--rail-text, #443c34);
        --workspace-muted: var(--rail-muted, #887969);
        --workspace-inactive: var(--rail-inactive, #938371);
        --workspace-border: var(--rail-border, #d2c5b7);
        --workspace-focus: var(--rail-focus, #7c634b);
        --workspace-hover: var(--rail-hover, #69554016);
        --workspace-surface: var(--rail-surface, #faf7f2);
    }
    .railway-table[data-theme='dark'] {
        color-scheme: dark;
        --rail-text: #e3e9ef;
        --rail-negative: #ff9c91;
        --rail-phase-tint: 100%;
        --rail-phase-filter: none;
        --rail-phase-opacity: 1;
        --rail-muted: #7f8e9e;
        --rail-inactive: #596777;
        --rail-surface: #222c37;
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
    .game-information { display: flex; align-items: center; justify-content: space-between; flex: none; gap: 3px; flex-wrap: wrap; margin-top: -8px; padding: 6px; border-bottom: 1px solid var(--rail-border, #b8a995); color: var(--rail-text, #514536); font-size: 12px; line-height: 20px; }
    @media (width < 40rem) {
        .game-information { margin-top: 0; }
    }
    .game-information-item { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
    .depot-information { border: 0; padding: 4px 5px; margin: -4px -5px; border-radius: 4px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .depot-information:hover { background: var(--rail-hover, #ffffff66); }
    .depot-information:focus-visible { outline: 2px solid var(--rail-focus, #9e7752); outline-offset: 2px; }
    .depot-type { display: inline-flex; align-items: center; gap: 3px; }
    .depot-information { flex-wrap: wrap; justify-content: flex-end; }
    .depot-count { font-size: 12px; font-weight: 700; line-height: 16px; font-variant-numeric: tabular-nums; }
    .train-limit-label { text-align: center; line-height: 10px; }
    .train-limit-value { font-size: 16px; font-weight: 700; line-height: 20px; }
    .information-label { color: var(--rail-muted, #887969); font-size: 10px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; line-height: 1; }


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
    .action-panel :global(section) {
        padding: 0;
        margin: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
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
