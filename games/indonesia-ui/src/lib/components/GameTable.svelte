<script lang="ts">
    import {
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        CustomFont
    } from '@tabletop/frontend-components'
    import type { GameSession } from '@tabletop/frontend-components'

    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'

    import { IndonesiaGameSession } from '$lib/model/session.svelte.js'
    import type { HydratedIndonesiaGameState, IndonesiaGameState } from '@tabletop/indonesia'
    import ScriptinaProFont from '$lib/fonts/Scriptina Pro.woff2'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<IndonesiaGameState, HydratedIndonesiaGameState> } = $props()

    function ensureIndonesiaGameSession(
        session: GameSession<IndonesiaGameState, HydratedIndonesiaGameState>
    ): IndonesiaGameSession {
        if (session instanceof IndonesiaGameSession) {
            return session
        }
        throw new Error('GameTable expected IndonesiaGameSession in gameSession prop.')
    }

    // svelte-ignore state_referenced_locally
    setGameSession(ensureIndonesiaGameSession(gameSession))
</script>

<CustomFont fontFamily="scriptina-pro" url={ScriptinaProFont} format="woff2" />

<!-- Full Height and Width with 8px padding-->
<div class="bg-[#ede2dc]" style="--chat-height-offset: 0px;">
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
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                <Header />
                {#if gameSession.gameState.result}
                    <!-- <GameEndPanel /> -->
                {:else}
                    <!-- <InformationPanel /> -->
                {/if}
            </div>
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    :global(.indonesia-font) {
        font-family: 'scriptina-pro', cursive;
    }
</style>
