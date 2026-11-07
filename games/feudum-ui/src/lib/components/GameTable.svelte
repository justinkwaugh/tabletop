<script lang="ts">
    import { untrack } from 'svelte'
    import {
        CustomFont,
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'
    import type { HydratedFeudumGameState, FeudumProjectedState } from '@tabletop/feudum'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import { FontFaces } from '$lib/fonts/fonts.js'
    import { FeudumGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<FeudumProjectedState, HydratedFeudumGameState> } = $props()

    function ensureFeudumGameSession(
        session: GameSession<FeudumProjectedState, HydratedFeudumGameState>
    ): FeudumGameSession {
        if (session instanceof FeudumGameSession) {
            return session
        }
        throw new Error('GameTable expected a FeudumGameSession')
    }

    setGameSession(untrack(() => ensureFeudumGameSession(gameSession)))
</script>

{#each FontFaces as face (face.family)}
    <CustomFont fontFamily={face.family} url={face.url} format="woff2" />
{/each}

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
