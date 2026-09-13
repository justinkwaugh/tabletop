<script lang="ts">
    import { companyFocusLocations } from '../maps/companyFocusLocations.js'
    import {
        getCompany,
        nextOperatingCompany,
        type OperatingRules,
        type CertificatePool
    } from '@tabletop/18xx'
    import type { ValuationRules } from '@tabletop/18xx'
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
    import type { PhaseChartData } from '../phases/phaseChart.js'
    let {
        session,
        marketPoolId,
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
        privateOperationDescription
    }: {
        session: FinanceExampleSession
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
        privateOperationDescription: (
            privateCompanyId: string,
            companyId: string
        ) => string | undefined
    } = $props()
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
    async function previewHistoryMap(action: GameAction) {
        focusedLocation = undefined
        focusedCompany = undefined
        focusedRoute = undefined
        session.previewHistoryMap(action)
        view = 'Map'
        const preview = session.historicalMap
        await tick()
        if (session.historicalMap !== preview) return
        if (preview?.locations.length) focusLocations(preview.locations)
        else mapWrapper?.fitToContent({ animate: true })
    }
    async function closeHistoricalMap() {
        session.closeHistoricalMap()
        await tick()
        if (!session.historicalMap) mapWrapper?.fitToContent({ animate: true })
    }
    const displayedScene = $derived(session.historicalMap?.scene ?? session.displayedMapScene)
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
                focusLocations([...new Set(locations)])
            })
        })
        return () => { cancelled = true }
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
    const tabsId = $props.id()
    let view = $state<(typeof views)[number]>('Map')

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

<div class="railway-table" aria-label="Game table">
    <DefaultTableLayout topPadding={0}>
        {#snippet sideContent()}
            <HistoryControls
                borderClass="border-b border-[#b8a995]"
                enabledColor="text-[#695540]"
                disabledColor="text-[#b9ae9f]"
                bgClass="bg-transparent"
            />
            <DefaultTabs
                fontClass="text-[11px] font-semibold uppercase tracking-[0.07em]"
                contentClass="p-0 mt-0 h-full overflow-auto rounded-none bg-transparent dark:bg-transparent"
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
        {/snippet}
        {#snippet gameContent()}
            <TableHeader {session} {phaseChart} {trainColors} />
            <section class="action-panel" aria-label="Current action">
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
                    class:historical={!!session.historicalMap}
                    class:inactive={view !== 'Map'}
                    role="tabpanel"
                    id={`${tabsId}-panel-Map`}
                    aria-labelledby={`${tabsId}-tab-Map`}
                    aria-hidden={view !== 'Map'}
                    inert={view !== 'Map'}
                >
                    <ScalingWrapper
                        bind:this={mapWrapper}
                        justify="center"
                        controls="bottom-left"
                        expandable={true}
                    >
                        <MapScene
                            scene={displayedScene}
                            tokens={session.historicalMap?.tokens ?? session.displayedMapTokens}
                            reservations={session.historicalMap?.reservations ?? session.trackPreview?.stationReservations ??
                                session.stationDisplayState.stationReservations}
                            routes={session.historicalMap?.routes ?? session.routeOverlays}
                            selection={session.historicalMap ? session.historicalMap.selection : session.mapSelection}
                            maskUnavailableLocations={!session.historicalMap && session.showTrackChoices}
                            legalLocationIds={session.historicalMap ? [] : session.canPlaceStation
                                ? session.stationLocationIds
                                : session.trackLocationIds}
                            previewLocationId={session.historicalMap ? undefined : session.trackPreview?.locationId ??
                                session.stationPreview?.position.locationId}
                            appearance={session.mapStyle === 'muted'
                                ? MutedTileAppearance
                                : ClassicTileAppearance}
                            hexDiameter={140}
                            onselect={session.historicalMap ? undefined : (selection) => session.selectMap(selection, false)}
                        />
                        {#snippet toolbar()}
                            {#if session.historicalMap}<div class="historical-map-toolbar">
                                <div class="historical-map-banner" role="status">
                                    <span><strong>Historical map</strong> · {session.historicalMap.label}</span>
                                    <button onclick={closeHistoricalMap}>Return to current map</button>
                                </div>
                            </div>{/if}
                        {/snippet}
                        {#snippet overlay(viewport)}
                            {#if !session.historicalMap && view === 'Map' && session.canBuildTrack && session.trackSelection.locationId}
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

<style>
    .railway-table {
        background: #ede2dc;
        color: #443c34;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .action-panel {
        flex-shrink: 0;
        max-height: 32dvh;
        min-height: 78px;
        overflow: auto;
        padding: 12px 16px;
        background: #faf7f1;
        border-bottom: 1px solid #b8a995;
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
    .historical { background: #dfd8ca; }
    .historical-map-toolbar { padding: 8px 12px; }
    .historical-map-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        border: 1px solid #715638;
        border-radius: 5px;
        background: #493b2bee;
        color: #fff8e9;
        box-shadow: 0 2px 8px #30271f33;
        font-size: 12px;
    }
    .historical-map-banner button {
        flex-shrink: 0;
        border: 1px solid #c3b394;
        border-radius: 4px;
        padding: 4px 8px;
        background: #faf5e8;
        color: #493b2b;
        font: inherit;
        cursor: pointer;
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
