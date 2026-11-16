<script lang="ts">
    import { untrack } from 'svelte'
    import {
        ScalingWrapper,
        DefaultTabs,
        HistoryControls,
        DefaultTableLayout,
        CustomFont,
        GameChat,
        GameSession,
        type DefaultTab
    } from '@tabletop/frontend-components'
    import type {
        HydratedRideTheRailsGameState,
        RideTheRailsGameState
    } from '@tabletop/ride-the-rails'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import RailroadCards from '$lib/components/RailroadCards.svelte'
    import Board from '$lib/components/Board.svelte'
    import BoardPopups from '$lib/components/board/BoardPopups.svelte'
    import TableFlightLayer from '$lib/components/board/TableFlightLayer.svelte'
    import TableControls from '$lib/components/panel/TableControls.svelte'
    import FullScreenControls from '$lib/components/panel/FullScreenControls.svelte'
    import BoardViewFollower from '$lib/components/BoardViewFollower.svelte'
    import { BoardView } from '$lib/model/boardView'
    import {
        BOARD_COVER_BELOW_SCALE,
        BOARD_MAX_FIT_SCALE,
        BOARD_MAX_SCALE
    } from '$lib/utils/boardFocus.js'
    import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
    import { FITTED_DESKTOP_SCALE, hexBox } from '$lib/utils/boardGeometry.js'
    import { keepFocusedHexInBoard } from '$lib/utils/focusScroll.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { RideTheRailsGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import { DisplayFontFamily, SerifFontFamily } from '$lib/definitions/fonts.js'
    import BigShouldersDisplayBold from '$lib/fonts/BigShouldersDisplay-Bold.woff2'
    import RideTheRailsSerifBold from '$lib/fonts/RideTheRailsSerif-Bold.woff2'

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

    let sideTab: DefaultTab | undefined = $state()

    let wrapper = $state<ScalingWrapper>()
    const boardView = new BoardView()
    /** Screen pixels kept between a hex panned into view and the board's edge. */
    const REVEAL_PADDING = 24

    // Contract, Phone layout: a hex focused out of view is panned into it, and nothing scrolls.
    const keepFocusInBoard = keepFocusedHexInBoard((hexId) => {
        boardView.moveByHand()
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
    url={RideTheRailsSerifBold}
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
        {#snippet mobileControlsContent()}
            <!-- The phone's history bar, inked for the table's paper as the side panel's is. -->
            <HistoryControls
                enabledColor="text-rtr-ink"
                disabledColor="text-rtr-line"
                borderClass="border-rtr-line border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
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
                bind:selectedTab={sideTab}
                activeTabClass="py-1 px-3 bg-rtr-panel-raised border-2 border-rtr-line rounded-lg text-rtr-ink"
                inactiveTabClass="py-1 px-3 rounded-lg border-2 border-transparent text-rtr-ink-muted hover:enabled:border-rtr-line"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <!-- The site's chat, inked for the table's paper. -->
                    <GameChat
                        timeColor="text-rtr-ink-muted"
                        messageTextColor="text-rtr-ink"
                        composerTextColor="text-rtr-ink"
                        messageHoverColor="hover:bg-rtr-panel"
                        inputBgColor="bg-rtr-panel-raised"
                        inputBorderColor="border-rtr-line"
                        borderColor="border-rtr-card-edge shadow-sm"
                        bgColor="bg-rtr-panel"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0"><TableControls /></div>
            <!-- Desktop only: on a phone the action panel's piles stand in for the cards, so a
                 railroad's pile is one flight target. -->
            {#if !isPhoneWidth()}<RailroadCards />{/if}
            <div class="flex min-h-0" style="flex:1;">
                <div
                    class="min-w-0 grow-0 overflow-hidden"
                    style="flex:1;"
                    {@attach keepFocusInBoard}
                >
                    <ScalingWrapper
                        bind:this={wrapper}
                        justify="center"
                        controls="bottom-left"
                        maxScale={BOARD_MAX_SCALE}
                        maxFitScale={BOARD_MAX_FIT_SCALE}
                        coverBelowScale={BOARD_COVER_BELOW_SCALE}
                        renderAtViewScale
                        expandable
                        onManualViewChange={() => boardView.moveByHand()}
                    >
                        <Board viewScale={wrapper?.viewScale() ?? FITTED_DESKTOP_SCALE} />
                        {#snippet overlay(viewport)}
                            <BoardViewFollower {wrapper} {viewport} {boardView} />
                        {/snippet}
                        {#snippet toolbar()}
                            <!-- Outside the content's CSS zoom, which would shrink and misplace the
                                 popups and the flyers that leave the map, and inside full screen's
                                 dialog. -->
                            <BoardPopups />
                            <FullScreenControls />
                            <TableFlightLayer />
                        {/snippet}
                    </ScalingWrapper>
                </div>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
