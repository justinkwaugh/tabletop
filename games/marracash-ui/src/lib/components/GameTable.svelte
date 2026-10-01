<script lang="ts">
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

    // svelte-ignore state_referenced_locally
    setGameSession(ensureMarracashGameSession(gameSession))
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
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <div class="flex flex-col items-center gap-3 p-2">
                        <Board />
                        <VisitorQueue />
                    </div>
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
