<script lang="ts">
    import { untrack } from 'svelte'
    import {
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'
    import type { HydratedMarracashGameState, MarracashProjectedState } from '@tabletop/marracash'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import VisitorQueue from '$lib/components/VisitorQueue.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import { MarracashGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<MarracashProjectedState, HydratedMarracashGameState> } = $props()

    function ensureMarracashGameSession(
        session: GameSession<MarracashProjectedState, HydratedMarracashGameState>
    ): MarracashGameSession {
        if (session instanceof MarracashGameSession) {
            return session
        }
        throw new Error('GameTable expected a MarracashGameSession')
    }

    setGameSession(untrack(() => ensureMarracashGameSession(gameSession)))
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
            <div class="shrink-0">
                <ActionPanel />
            </div>
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <div class="flex flex-col items-center gap-3 p-2 pb-14">
                        <Board />
                        <VisitorQueue />
                    </div>
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
