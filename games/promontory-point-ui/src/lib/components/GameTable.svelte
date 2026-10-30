<script lang="ts">
    import { untrack } from 'svelte'
    import {
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'
    import type {
        HydratedPromontoryPointGameState,
        PromontoryPointGameState
    } from '@tabletop/promontory-point'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import { PromontoryPointGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: {
        gameSession: GameSession<PromontoryPointGameState, HydratedPromontoryPointGameState>
    } = $props()

    function ensurePromontoryPointGameSession(
        session: GameSession<PromontoryPointGameState, HydratedPromontoryPointGameState>
    ): PromontoryPointGameSession {
        if (session instanceof PromontoryPointGameSession) {
            return session
        }
        throw new Error('GameTable expected an PromontoryPointGameSession')
    }

    setGameSession(untrack(() => ensurePromontoryPointGameSession(gameSession)))
</script>

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
