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
    import Board from '$lib/components/Board.svelte'
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

    setGameSession(untrack(() => ensureRideTheRailsGameSession(gameSession)))
</script>

<CustomFont
    fontFamily={DisplayFontFamily}
    url={BigShouldersDisplayBold}
    format="woff2"
    fontWeight="700"
/>

<div>
    <DefaultTableLayout>
        {#snippet sideContent()}
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
            <div class="shrink-0"></div>
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
