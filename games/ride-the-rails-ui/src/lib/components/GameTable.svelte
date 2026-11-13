<script lang="ts">
    import { untrack } from 'svelte'
    import {
        ScalingWrapper,
        DefaultSideContent,
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
    import TableControls from '$lib/components/panel/TableControls.svelte'
    import FullScreenControls from '$lib/components/panel/FullScreenControls.svelte'
    import BoardFocusChooser from '$lib/components/BoardFocusChooser.svelte'
    import { BoardFocusSelection } from '$lib/model/boardFocus.svelte'
    import { BOARD_COVER_BELOW_SCALE, BOARD_MAX_SCALE } from '$lib/utils/boardFocus.js'
    import { boardInsetTop } from '$lib/utils/phoneLayout.svelte.js'
    import { FITTED_DESKTOP_SCALE, hexBox } from '$lib/utils/boardGeometry.js'
    import { keepFocusedHexInBoard } from '$lib/utils/focusScroll.js'
    import { RideTheRailsGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import { DisplayFontFamily } from '$lib/definitions/fonts.js'
    import BigShouldersDisplayBold from '$lib/fonts/BigShouldersDisplay-Bold.woff2'

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
        focus.release()
        wrapper?.revealRect(hexBox(hexId), { padding: REVEAL_PADDING })
    })
</script>

<CustomFont
    fontFamily={DisplayFontFamily}
    url={BigShouldersDisplayBold}
    format="woff2"
    fontWeight="700"
/>

<div class="bg-rtr-table">
    <DefaultTableLayout>
        {#snippet sideContent()}
            {#if sidePanelHexId}
                {#key sidePanelHexId}
                    <HexDetailCard hexId={sidePanelHexId} />
                {/key}
            {/if}
            <DefaultSideContent>
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
            </DefaultSideContent>
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
                    coverBelowScale={BOARD_COVER_BELOW_SCALE}
                    insetTop={boardInsetTop()}
                    renderAtViewScale
                    expandable
                    onManualViewChange={() => focus.release()}
                >
                    <Board viewScale={wrapper?.viewScale() ?? FITTED_DESKTOP_SCALE} />
                    {#snippet overlay(viewport)}
                        <BoardFocusChooser {wrapper} {viewport} selection={focus} />
                    {/snippet}
                    {#snippet toolbar()}
                        <!-- Outside the content's CSS zoom, which would shrink and misplace the popups,
                             and inside full screen's dialog. -->
                        <BoardPopups />
                        <FullScreenControls />
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
