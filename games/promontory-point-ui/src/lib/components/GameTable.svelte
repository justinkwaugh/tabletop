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
        HydratedPromontoryPointGameState,
        PromontoryPointProjectedState
    } from '@tabletop/promontory-point'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import { PromontoryPointGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import Oswald500 from '$lib/fonts/Oswald-500.woff2'
    import Oswald600 from '$lib/fonts/Oswald-600.woff2'

    let {
        gameSession
    }: {
        gameSession: GameSession<PromontoryPointProjectedState, HydratedPromontoryPointGameState>
    } = $props()

    function ensurePromontoryPointGameSession(
        session: GameSession<PromontoryPointProjectedState, HydratedPromontoryPointGameState>
    ): PromontoryPointGameSession {
        if (session instanceof PromontoryPointGameSession) {
            return session
        }
        throw new Error('GameTable expected an PromontoryPointGameSession')
    }

    setGameSession(untrack(() => ensurePromontoryPointGameSession(gameSession)))
</script>

<CustomFont fontFamily="Oswald" url={Oswald500} format="woff2" fontWeight={500} />
<CustomFont fontFamily="Oswald" url={Oswald600} format="woff2" fontWeight={600} />

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
