<script lang="ts">
    import {
        ScalingWrapper,
        HistoryControls,
        DefaultTabs,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'

    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import ActionToolbar from '$lib/components/ActionToolbar.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import TestingControls from '$lib/components/TestingControls.svelte'
    import PoliticsHand from '$lib/components/PoliticsHand.svelte'
    import parchmentTexture from '$lib/images/board/parchment-texture.jpg'

    import type { LowenherzGameSession } from '$lib/model/session.svelte'
    import type { HydratedLowenherzGameState, LowenherzGameState } from '@tabletop/lowenherz'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<LowenherzGameState, HydratedLowenherzGameState> } = $props()
    setGameSession(gameSession as LowenherzGameSession)

    // Exposes the session for console debugging (Svelte context isn't reachable from
    // devtools otherwise) - e.g. `__gameSession.myRegions`.
    if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).__gameSession = gameSession
    }
</script>

<!-- Full Height and Width with 8px padding-->
<div
    style="--chat-height-offset: 0px; background-image: url({parchmentTexture}); background-repeat: repeat;"
>
    <DefaultTableLayout>
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    borderClass="border-b-2 border-black/20"
                    bgClass="bg-transparent"
                    enabledColor="text-black"
                    disabledColor="text-black/30"
                />
            </div>
            <DefaultTabs
                inactiveTabClass="text-black py-1 px-3 rounded-lg border-2 border-transparent hover:border-black/40"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                    <TestingControls />
                {/snippet}
                {#snippet history()}
                   <History />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                {#if gameSession.gameState.result}
                    <GameEndPanel />
                {:else}
                    <!-- <InformationPanel /> -->
                {/if}
                <ActionToolbar />
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

<!-- Rendered here (outside ScalingWrapper's transformed subtree) so its
     `position: fixed` is genuinely relative to the browser viewport, not scaled or
     clipped by the board's own responsive scaling. -->
<PoliticsHand />
