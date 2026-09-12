<script lang="ts">
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
    import { ClassicTileAppearance, MutedTileAppearance } from '../tiles/tileAppearance.js'
    import TrackTilePicker from '../maps/TrackTilePicker.svelte'
    import PlayersPanel from './PlayersPanel.svelte'
    import History from './History.svelte'
    import TableHeader from './TableHeader.svelte'
    let {
        session,
        actions,
        operatingRules,
        poolName,
        trainColors,
        valuationRules,
        portfolioCompanyIds = [],
        privateOperationDescription
    }: {
        session: FinanceExampleSession
        actions: Snippet<[(locationId: string) => void]>
        operatingRules: OperatingRules
        portfolioCompanyIds?: readonly string[]
        valuationRules: ValuationRules
        trainColors: Readonly<Record<string, string>>
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
        mapWrapper?.focusRect(mapSelectionRect(scene, { kind: 'hex', locationId }, 140, 150), {
            animate: true
        })
    }
    let mapViewport: HTMLDivElement | undefined = $state()
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
    <DefaultTableLayout>
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
                        {portfolioCompanyIds}
                    />{/snippet}
                {#snippet history()}<History {session} />{/snippet}
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
            <TableHeader {session} />
            <section class="action-panel" aria-label="Current action">
                {@render actions(focusLocation)}
            </section>
            <CompanyOrder
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
                    bind:this={mapViewport}
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
                        justify="center"
                        controls="bottom-left"
                        expandable={true}
                    >
                        <MapScene
                            scene={session.displayedMapScene}
                            tokens={session.displayedMapTokens}
                            reservations={session.trackPreview?.stationReservations ??
                                session.stationDisplayState.stationReservations}
                            routes={session.displayedRoutes}
                            selection={session.mapSelection}
                            maskUnavailableLocations={session.showTrackChoices}
                            legalLocationIds={session.canPlaceStation
                                ? session.stationLocationIds
                                : session.trackLocationIds}
                            previewLocationId={session.trackPreview?.locationId ??
                                session.stationPreview?.position.locationId}
                            appearance={session.mapStyle === 'muted'
                                ? MutedTileAppearance
                                : ClassicTileAppearance}
                            hexDiameter={140}
                            onselect={(selection) => session.selectMap(selection, false)}
                        />
                    </ScalingWrapper>
                    {#if mapViewport && view === 'Map' && session.canBuildTrack && session.trackSelection.locationId}
                        <TrackTilePicker {session} viewport={mapViewport} />
                    {/if}
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
                    <p class="placeholder">Spreadsheet coming later.</p>
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
        border-top: 1px solid #b8a995;
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
    .placeholder {
        margin: 24px 0;
        color: #8b7b6b;
        font-size: 13px;
    }
</style>
