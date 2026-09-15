<script lang="ts">
    import { companyFocusLocations } from '../maps/companyFocusLocations.js'
    import {
        getCompany,
        nextOperatingCompany,
        type OperatingRules,
        type CertificatePool
    } from '@tabletop/18xx'
    import type { ValuationRules } from '@tabletop/18xx'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import OperatingSteps from './OperatingSteps.svelte'
    import StockActionStrip from './StockActionStrip.svelte'
    import type { StockMenuOption } from '../stock/stockActionSelection.js'
    import CompanyDetails from './CompanyDetails.svelte'
    import CompanyOrder from './CompanyOrder.svelte'
    import { untrack, tick, type Snippet } from 'svelte'
    import {
        DefaultTableLayout,
        DefaultTabs,
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
    import type { GameAction } from '@tabletop/common'
    import type { HistoryDescription } from './historyDescription.js'
    import History from './History.svelte'
    import TableHeader from './TableHeader.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import PhaseChart from '../phases/PhaseChart.svelte'
    import type { PhaseChartData } from '../phases/phaseChart.js'
    let {
        session,
        marketPoolId,
        companyRoles = [],
        additionalStockActions = [],
        gameInformation,
        exchangePoolId,
        companyNames,
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
        privatePurchaseLabel = 'Buy privates',
        privateOperationDescription
    }: {
        session: FinanceExampleSession
        additionalStockActions?: readonly StockMenuOption[]
        gameInformation?: Snippet
        companyRoles?: readonly { companyId: string; label: string; secondLine?: string }[]
        marketPoolId: string
        exchangePoolId?: string
        companyNames?: Readonly<Record<string, CompanyNameVariants>>
        auctionLotDescription?: (id: string) => string
        numberedShareNames?: NumberedShareNames
        numberedShareLocation?: (companyId: string, number: number) => string | undefined
        mapFocusExcludedCompanyIds?: readonly string[]
        actions: Snippet<[(locationId: string) => void, (trainId: string) => void]>
        operatingRules: OperatingRules
        portfolioCompanyIds?: readonly string[]
        valuationRules: ValuationRules
        trainColors: Readonly<Record<string, string>>
        phaseColors: Readonly<Record<string, string>>
        phaseChart: PhaseChartData
        phaseTileColors: Readonly<Record<string, readonly string[]>>
        historyDescription?: (action: GameAction) => HistoryDescription | undefined
        poolName?: (pool: CertificatePool) => string
        privatePurchaseLabel?: string
        privateOperationDescription: (
            privateCompanyId: string,
            companyId: string
        ) => string | undefined
    } = $props()
    let showDepot = $state(false)
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
        view = 'Map'
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
        view = 'Map'
        await tick()
        if (restore) {
            mapWrapper?.fitToContent({ animate: true })
            return
        }
        const locations = companyFocusLocations(session.stationDisplayState, companyId)
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
        view = 'Map'
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
    function focusLocations(locations: readonly string[]) {
        const rectangles = locations.map((locationId) => mapSelectionRect(
            displayedScene, { kind: 'hex', locationId }, 140, 220
        ))
        const x = Math.min(...rectangles.map((rect) => rect.x))
        const y = Math.min(...rectangles.map((rect) => rect.y))
        const right = Math.max(...rectangles.map((rect) => rect.x + rect.width))
        const bottom = Math.max(...rectangles.map((rect) => rect.y + rect.height))
        mapWrapper?.focusRect({ x, y, width: right - x, height: bottom - y }, { animate: true })
    }
    const consentPreview = $derived(session.financialState.trackConsent)
    const maskPlacementLocations = $derived(!consentPreview &&
        (session.showTrackChoices || session.financialState.machineState === 'PlacingStation'))
    const placementLocationIds = $derived(session.canPlaceStation
        ? session.stationLocationIds : session.trackLocationIds)
    const placementFocusKey = $derived(consentPreview?.id ?? (maskPlacementLocations
        ? JSON.stringify([session.financialState.machineState, placementLocationIds]) : undefined))
    $effect(() => {
        if (!placementFocusKey || session.updatingVisibleState) return
        return untrack(() => {
            const locations = consentPreview ? [consentPreview.details.locationId] : [...placementLocationIds]
            if (!locations.length) return
            let cancelled = false
            view = 'Map'
            void tick().then(() => {
                if (!cancelled) focusLocations(locations)
            })
            return () => { cancelled = true }
        })
    })
    let restoreRouteView: ReturnType<ScalingWrapper['captureView']> | undefined
    const runningCompanyId = $derived(session.financialState.machineState === 'RunningTrains'
        ? session.financialState.routeStep?.companyId : undefined)
    $effect(() => {
        if (!runningCompanyId) return
        return () => {
            const restore = restoreRouteView
            restoreRouteView = undefined
            restore?.({ animate: true })
        }
    })
    $effect(() => {
        const preview = session.automaticRouteResult
        if (!preview?.result.routes.length) return
        let cancelled = false
        untrack(() => {
            focusedRoute = undefined
            focusedLocation = undefined
            focusedCompany = undefined
            view = 'Map'
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
            view = 'Map'
            void tick().then(() => {
                if (cancelled) return
                const locations = companyFocusLocations(session.stationDisplayState, selected.companyId)
                if (locations.length) focusLocations(locations)
            })
            return () => {
                cancelled = true
                if (session.busy || session.updatingVisibleState || session.isViewingHistory) return
                view = previousView
                void tick().then(() => restore?.({ animate: true }))
            }
        })
    })
    const financialState = $derived(session.financialState)
    const operating = $derived(financialState.stockRound.completed && !!financialState.operatingSet)
    const companyOrder = $derived(
        (operating && financialState.operatingSet
            ? financialState.operatingSet.companyOrder
            : operatingRules.companyOrder(financialState)
        ).map((id) => getCompany(financialState, id))
    )
    setGameSession(untrack(() => session))
    const views = ['Map', 'Market', 'Spreadsheet', 'Tiles'] as const
    let sidebar: HTMLDivElement
    const tabsId = $props.id()
    let view = $state<(typeof views)[number]>('Map')

    function navigateByShortcut(event: KeyboardEvent) {
        if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
        const target = event.target
        if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"], [role="dialog"]'))) return
        const key = event.key.toLowerCase()
        const viewIndex = ['m', 'k', 's', 't'].indexOf(key)
        if (viewIndex >= 0) {
            event.preventDefault()
            view = views[viewIndex]
            return
        }
        const sidebarIndex = ['p', 'h', 'c'].indexOf(key)
        if (sidebarIndex >= 0) {
            const tab = sidebar.querySelectorAll<HTMLButtonElement>('[role="tab"]')[sidebarIndex]
            if (tab) {
                event.preventDefault()
                tab.click()
            }
        }
    }

    function navigateTabs(event: KeyboardEvent, index: number) {
        let next: number
        if (event.key === 'ArrowRight') next = (index + 1) % views.length
        else if (event.key === 'ArrowLeft') next = (index + views.length - 1) % views.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = views.length - 1
        else return
        event.preventDefault()
        view = views[next]
        if (event.currentTarget instanceof HTMLElement)
            event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus()
    }
</script>

<svelte:window onkeydown={navigateByShortcut} />

<div class="railway-table" aria-label="Game table">
    <DefaultTableLayout topPadding={0}>
        {#snippet sideContent()}
            <HistoryControls
                borderClass="border-b border-[#b8a995]"
                enabledColor="text-[#695540]"
                disabledColor="text-[#b9ae9f]"
                bgClass="bg-transparent"
            />
            <div class="game-information" aria-label="Game information">
                {#each companyRoles as role (role.companyId)}
                    <div class="game-information-item" title={`${role.label}: ${getCompany(session.financialState, role.companyId).name}`}>
                        <span class="information-label role-label">{role.label}{#if role.secondLine}<br />{role.secondLine}{/if}</span>
                        <CompanyToken appearance={session.mapView.stations[role.companyId]} size={16} />
                    </div>
                {/each}
                <div class="game-information-item">
                    <span class="information-label train-limit-label">Train<br />limit</span>
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
            <div bind:this={sidebar} style="display: contents">
            <DefaultTabs
                fontClass="text-[11px] font-semibold uppercase tracking-[0.07em]"
                contentClass="p-0 mt-0 has-[.round-history]:-mt-1 h-full overflow-auto rounded-none bg-transparent dark:bg-transparent"
                activeTabClass="py-2 px-2 text-[#5e4937] rounded-none"
                inactiveTabClass="py-2 px-2 text-[#998b79] hover:text-[#5e4937] rounded-none"
            >
                {#snippet playersPanel()}<PlayersPanel
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
                {#snippet history()}<History onPreviewMap={previewHistoryMap} {session} {trainColors} {phaseColors} {phaseTileColors} {companyNames} describeAction={historyDescription} />{/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-[#887969]"
                        messageTextColor="text-[#4b4239]"
                        composerTextColor="text-[#4b4239]"
                        messageHoverColor="hover:bg-[#e7ded3]"
                        inputBgColor="bg-[#faf7f2]"
                        inputBorderColor="border-[#b8a995]"
                        borderColor="border-[#b8a995]"
                    />
                {/snippet}
            </DefaultTabs>
            </div>
        {/snippet}
        {#snippet gameContent()}
            <TableHeader {session} {phaseChart} {trainColors} />
            <OperatingSteps {session} {privatePurchaseLabel} />
            <StockActionStrip {session} additionalActions={additionalStockActions} />
            <section class="action-panel" class:share-purchases={session.financialState.machineState === 'StockRound'} aria-label="Current action">
                {@render actions(focusLocation, focusRoute)}
            </section>
            {#if companyOrder.length}
            <CompanyOrder
                showDetails={session.preferences.values.operatingOrderDisplay === 'details'}
                onDisplayChange={(details) =>
                    session.preferences.set(
                        { operatingOrderDisplay: details ? 'details' : 'tokens' },
                        'family'
                    )}
                companies={companyOrder}
                state={financialState}
                trainDepot={session.trainDepot}
                {trainColors}
                requiresTrain={(companyId) => session.companyRequiresTrain(companyId)}
                appearances={session.mapView.stations}
                prospective={!operating}
                completedCompanyIds={operating
                    ? financialState.operatingSet?.completedCompanyIds
                    : []}
                currentCompanyId={operating && !financialState.result
                    ? nextOperatingCompany(financialState)
                    : undefined}
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
            {/if}
            <div class="view-tabs" role="tablist" aria-label="Table views">
                {#each views as name, index}
                    <button
                        id={`${tabsId}-tab-${name}`}
                        role="tab"
                        aria-selected={view === name}
                        aria-controls={`${tabsId}-panel-${name}`}
                        tabindex={view === name ? 0 : -1}
                        onclick={() => (view = name)}
                        onkeydown={(event) => navigateTabs(event, index)}>{name}</button
                    >
                {/each}
            </div>
            <div class="view-area">
                <div
                    class="view-panel map-area"
                    class:inactive={view !== 'Map'}
                    role="tabpanel"
                    id={`${tabsId}-panel-Map`}
                    aria-labelledby={`${tabsId}-tab-Map`}
                    aria-hidden={view !== 'Map'}
                    inert={view !== 'Map'}
                >
                    <ScalingWrapper
                        bind:this={mapWrapper}
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
                            routes={session.routeOverlays}
                            selection={session.mapSelection}
                            maskUnavailableLocations={maskPlacementLocations}
                            legalLocationIds={placementLocationIds}
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
                            {#if view === 'Map' && session.canBuildTrack && session.trackSelection.locationId}
                                <TrackTilePicker {session} {viewport} />
                            {/if}
                        {/snippet}
                    </ScalingWrapper>
                </div>
                <div
                    class="view-panel market-area"
                    class:inactive={view !== 'Market'}
                    role="tabpanel"
                    id={`${tabsId}-panel-Market`}
                    aria-labelledby={`${tabsId}-tab-Market`}
                    aria-hidden={view !== 'Market'}
                    inert={view !== 'Market'}
                    tabindex="0"
                >
                    <ScalingWrapper justify="center" controls="bottom-left" expandable={true}>
                        <StockMarketScene
                            {session}
                            appearances={session.mapView.stations}
                            renderScale={2}
                            market={session.financialState.stockMarket}
                            companies={session.financialState.companies}
                        />
                    </ScalingWrapper>
                </div>
                <div
                    class="view-panel data-area"
                    class:inactive={view !== 'Spreadsheet'}
                    role="tabpanel"
                    id={`${tabsId}-panel-Spreadsheet`}
                    aria-labelledby={`${tabsId}-tab-Spreadsheet`}
                    aria-hidden={view !== 'Spreadsheet'}
                    inert={view !== 'Spreadsheet'}
                    tabindex="0"
                >
                    <OwnershipSpreadsheet
                        {valuationRules}
                        {session}
                        {companyNames}
                        {marketPoolId}
                        {exchangePoolId}
                        {portfolioCompanyIds}
                    />
                </div>
                <div
                    class="view-panel"
                    class:inactive={view !== 'Tiles'}
                    role="tabpanel"
                    id={`${tabsId}-panel-Tiles`}
                    aria-labelledby={`${tabsId}-tab-Tiles`}
                    aria-hidden={view !== 'Tiles'}
                    inert={view !== 'Tiles'}
                    tabindex="0"
                >
                    <TileManifest
                        tiles={session.mapView.tileSet.definitions}
                        inventory={session.tileCounts}
                        layouts={session.mapView.layouts}
                        orientation={session.mapView.map.definition.orientation}
                        appearance={session.mapStyle === 'muted'
                            ? MutedTileAppearance
                            : ClassicTileAppearance}
                    />
                </div>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

{#if showDepot}<PhaseChart depotView={{ depot: session.trainDepot, inventory: session.financialState.trainInventory, availableDefinitionIds: session.availableTrainDefinitionIds }} chart={phaseChart} currentPhaseId={session.financialState.phaseId} {trainColors} onclose={() => showDepot = false} />{/if}

{#if session.historicalMap}
    <HistoricalMapViewer preview={session.historicalMap}
        revenueStageColors={session.mapView.revenueStageColors}
        appearance={session.mapStyle === 'muted' ? MutedTileAppearance : ClassicTileAppearance}
        onclose={() => session.closeHistoricalMap()} />
{/if}

<style>
    .game-information { display: flex; align-items: center; justify-content: space-between; flex: none; gap: 3px; flex-wrap: wrap; margin-top: -8px; padding: 6px; border-bottom: 1px solid #b8a995; color: #514536; font-size: 12px; line-height: 20px; }
    .game-information-item { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
    .depot-information { border: 0; padding: 4px 5px; margin: -4px -5px; border-radius: 4px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .depot-information:hover { background: #ffffff66; }
    .depot-information:focus-visible { outline: 2px solid #9e7752; outline-offset: 2px; }
    .depot-type { display: inline-flex; align-items: center; gap: 3px; }
    .depot-information { flex-wrap: wrap; justify-content: flex-end; }
    .depot-count { font-size: 12px; font-weight: 700; line-height: 16px; font-variant-numeric: tabular-nums; }
    .role-label,
    .train-limit-label { text-align: center; line-height: 10px; }
    .train-limit-value { font-size: 16px; font-weight: 700; line-height: 20px; }
    .information-label { color: #887969; font-size: 10px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; line-height: 1; }


    .railway-table {
        background: #ede2dc;
        color: #443c34;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .action-panel {
        flex-shrink: 0;
        max-height: 32dvh;
        min-height: 0;
        overflow: auto;
        padding: 10px 16px;
        background: #faf7f1;
        border-bottom: 1px solid #b8a995;
        font-size: 13px;
    }
    .action-panel.share-purchases { max-height: 50dvh; }
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
        background: #443e35;
        border-color: #443e35;
        color: #fff;
    }
    .action-panel :global(button.action-button:hover:not(:disabled)) {
        background: #302c26;
        border-color: #302c26;
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
    .view-tabs {
        display: flex;
        flex-shrink: 0;
        gap: 24px;
        padding: 0 16px;
        border-bottom: 1px solid #d2c5b7;
    }
    .view-tabs button {
        padding: 12px 0 10px;
        border: 0;
        border-bottom: 2px solid transparent;
        background: transparent;
        color: #938371;
        font: inherit;
        font-size: 11px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
    }
    .view-tabs button[aria-selected='true'] {
        color: #5e4937;
        border-bottom-color: #7c634b;
    }
    .view-tabs button:hover {
        color: #5e4937;
    }
    .map-area {
        position: relative;
    }
    .view-area {
        display: grid;
        flex: 1;
        min-height: 0;
        min-width: 0;
    }
    .view-panel {
        grid-area: 1 / 1;
        min-height: 0;
        min-width: 0;
        overflow: auto;
    }
    .map-area,
    .market-area {
        overflow: hidden;
    }
    .data-area {
        padding: 8px 16px;
    }
    .inactive {
        visibility: hidden;
        pointer-events: none;
    }
</style>
