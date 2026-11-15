<script lang="ts">
    import { untrack } from 'svelte'
    import {
        ScalingWrapper,
        DefaultTabs,
        HistoryControls,
        DefaultTableLayout,
        CustomFont,
        GameSession
    } from '@tabletop/frontend-components'
    import type {
        HydratedRideTheRailsGameState,
        RideTheRailsGameState
    } from '@tabletop/ride-the-rails'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import PhoneRailroadStrip from '$lib/components/PhoneRailroadStrip.svelte'
    import Board from '$lib/components/Board.svelte'
    import BoardPopups from '$lib/components/board/BoardPopups.svelte'
    import HexDetailCard from '$lib/components/board/HexDetailCard.svelte'
    import PhoneFlightLayer from '$lib/components/board/PhoneFlightLayer.svelte'
    import TableControls from '$lib/components/panel/TableControls.svelte'
    import FullScreenControls from '$lib/components/panel/FullScreenControls.svelte'
    import BoardFocusChooser from '$lib/components/BoardFocusChooser.svelte'
    import { BoardFocusSelection } from '$lib/model/boardFocus.svelte'
    import {
        BOARD_COVER_BELOW_SCALE,
        BOARD_MAX_FIT_SCALE,
        BOARD_MAX_SCALE
    } from '$lib/utils/boardFocus.js'
    import { boardInsetTop } from '$lib/utils/phoneLayout.svelte.js'
    import { FITTED_DESKTOP_SCALE, hexBox } from '$lib/utils/boardGeometry.js'
    import { keepFocusedHexInBoard } from '$lib/utils/focusScroll.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { RideTheRailsGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import { DisplayFontFamily, SerifFontFamily } from '$lib/definitions/fonts.js'
    import BigShouldersDisplayBold from '$lib/fonts/BigShouldersDisplay-Bold.woff2'
    import LibreBaskervilleBold from '$lib/fonts/LibreBaskerville-Bold.woff2'

    let {
        gameSession
    }: { gameSession: GameSession<RideTheRailsGameState, HydratedRideTheRailsGameState> } = $props()

    function ensureRideTheRailsGameSession(
        session: GameSession<RideTheRailsGameState, HydratedRideTheRailsGameState>
    ): RideTheRailsGameSession {
        if (session instanceof RideTheRailsGameSession) {
            return session
        }
        throw new Error('GameTable expected a RideTheRailsGameSession')
    }

    const session = untrack(() => ensureRideTheRailsGameSession(gameSession))
    setGameSession(session)

    let wrapper = $state<ScalingWrapper>()
    const focus = new BoardFocusSelection()
    /** Screen pixels kept between a hex panned into view and the board's edge. */
    const REVEAL_PADDING = 24

    // Contract, Coexistence and precedence: during a map pick on wider screens the hex detail opens
    // in the side panel.
    const sidePanelHexId = $derived(
        session.hexDetailInSidePanel ? session.hexDetailHexId : undefined
    )

    // Contract, Phone layout: a hex focused out of view is panned into it, and nothing scrolls.
    const keepFocusInBoard = keepFocusedHexInBoard((hexId) => {
        focus.moveByHand()
        wrapper?.revealRect(hexBox(hexId), { padding: REVEAL_PADDING })
    })
</script>

<CustomFont
    fontFamily={DisplayFontFamily}
    url={BigShouldersDisplayBold}
    format="woff2"
    fontWeight="700"
/>
<CustomFont
    fontFamily={SerifFontFamily}
    url={LibreBaskervilleBold}
    format="woff2"
    fontWeight="700"
/>

<!-- The palette's tokens sit on the table (src/app.css), so everything the title draws sees them. -->
<div
    class="bg-rtr-table"
    data-rtr-table
    data-rtr-palette={BOARD_LOOK.palette}
    {@attach session.flights.attachTable}
>
    <DefaultTableLayout>
        {#snippet sideContent()}
            {#if sidePanelHexId}
                {#key sidePanelHexId}
                    <HexDetailCard hexId={sidePanelHexId} />
                {/key}
            {/if}
            <!-- The site's history bar and tabs, inked for the table's paper. -->
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-rtr-ink"
                    disabledColor="text-rtr-line"
                    borderClass="rounded-lg border-2 border-rtr-line"
                    bgClass="bg-rtr-panel-raised"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-rtr-panel-raised border-2 border-rtr-line rounded-lg text-rtr-ink"
                inactiveTabClass="py-1 px-3 rounded-lg border-2 border-transparent text-rtr-ink-muted hover:enabled:border-rtr-line"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0"><TableControls /></div>
            <PhoneRailroadStrip />
            <div class="grow-0 overflow-hidden" style="flex:1;" {@attach keepFocusInBoard}>
                <ScalingWrapper
                    bind:this={wrapper}
                    justify="center"
                    controls="bottom-left"
                    maxScale={BOARD_MAX_SCALE}
                    maxFitScale={BOARD_MAX_FIT_SCALE}
                    coverBelowScale={BOARD_COVER_BELOW_SCALE}
                    insetTop={boardInsetTop()}
                    renderAtViewScale
                    expandable
                    onManualViewChange={() => focus.moveByHand()}
                >
                    <Board viewScale={wrapper?.viewScale() ?? FITTED_DESKTOP_SCALE} />
                    {#snippet overlay(viewport)}
                        <BoardFocusChooser {wrapper} {viewport} selection={focus} />
                    {/snippet}
                    {#snippet toolbar()}
                        <!-- Outside the content's CSS zoom, which would shrink and misplace the popups
                             and the phone's flyers, and inside full screen's dialog. -->
                        <BoardPopups />
                        <FullScreenControls />
                        <PhoneFlightLayer />
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
