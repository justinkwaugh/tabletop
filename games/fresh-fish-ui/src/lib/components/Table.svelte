<script lang="ts">
    import {
        GameSessionMode,
        ScalingWrapper,
        DefaultTabs,
        HistoryControls,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'

    import { onMount } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import type { FreshFishGameState, HydratedFreshFishGameState } from '@tabletop/fresh-fish'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import GameDataPanel from '$lib/components/GameDataPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import LastActionDescription from './LastActionDescription.svelte'
    import { setGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { CustomFont } from '@tabletop/frontend-components'
    import LilitaOne from '$lib/fonts/LilitaOne-Latin.woff2'
    import { LABEL_LIGHT, TRAY } from '$lib/utils/pieceColors.js'

    let {
        gameSession
    }: { gameSession: GameSession<FreshFishGameState, HydratedFreshFishGameState> } = $props()

    // svelte-ignore state_referenced_locally
    setGameSession(gameSession as FreshFishGameSession)
</script>

<CustomFont fontFamily="Fresh Fish Lilita One" url={LilitaOne} format="woff2" fontWeight="800" />

<div
    style:--ff-label-font="'Fresh Fish Lilita One'"
    style:--ff-label={LABEL_LIGHT}
    style:--ff-tray={TRAY}
>
    <DefaultTableLayout>
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls />
            </div>
            <DefaultTabs
                fontClass="ff-tab-font"
                activeTabClass="py-1 px-2 bg-gray-300 border-2 border-transparent rounded-lg text-gray-900"
                inactiveTabClass="text-gray-200 py-1 px-2 rounded-lg border-2 border-transparent hover:border-gray-700"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
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
                    {#if gameSession.undoableAction}
                        <LastActionDescription />
                    {/if}
                    <GameEndPanel />
                {:else if gameSession.isViewingHistory}
                    <LastActionDescription />
                {:else if gameSession.isPlayable}
                    <LastActionDescription />
                    {#if gameSession.isMyTurn}
                        <ActionPanel />
                    {:else}
                        <WaitingPanel />
                    {/if}
                {/if}
            </div>
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="grow-0 overflow-hidden min-h-[200px]" style="flex:1;">
                <ScalingWrapper justify="center" controls="top-right">
                    <div class="harbor w-fit h-fit">
                        <GameDataPanel />
                        <Board />
                    </div>
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    :global(.ff-tab-font) {
        font-family: var(--ff-label-font, inherit);
        font-size: 1.05rem;
        letter-spacing: 0.02em;
    }

    .harbor {
        padding: 14px 42px 44px;
        border-radius: 22px;
        background:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='24'%3E%3Cpath d='M0 12 Q8 6 16 12 T32 12 T48 12 T64 12' fill='none' stroke='%23ffffff' stroke-opacity='0.07' stroke-width='1.5'/%3E%3C/svg%3E"),
            radial-gradient(120% 90% at 30% 20%, #1d5a6e 0%, #123f52 45%, #0b2837 100%);
        margin: 12px;
        box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.08),
            inset 0 0 60px rgba(0, 0, 0, 0.35),
            0 20px 50px rgba(0, 0, 0, 0.5);
    }
</style>
