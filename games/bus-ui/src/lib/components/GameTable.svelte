<script lang="ts">
    import {
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'

    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'

    import type { BusGameSession } from '$lib/model/session.svelte'
    import type { HydratedBusGameState, BusGameState } from '@tabletop/bus'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let { gameSession }: { gameSession: GameSession<BusGameState, HydratedBusGameState> } = $props()
    setGameSession(gameSession as BusGameSession)
</script>

<!-- Full Height and Width with 8px padding-->
<div class="bg-[#f0f1ec]" style="--chat-height-offset: 0px;">
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
