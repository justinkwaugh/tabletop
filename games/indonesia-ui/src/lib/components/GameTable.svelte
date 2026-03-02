<script lang="ts">
    import {
        ScalingWrapper,
        HistoryControls,
        DefaultTabs,
        DefaultTableLayout,
        CustomFont
    } from '@tabletop/frontend-components'
    import type { GameSession } from '@tabletop/frontend-components'

    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GoodsValueStrip from '$lib/components/GoodsValueStrip.svelte'

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
            <div class="max-sm:hidden">
                <HistoryControls
                    borderClass="border-b border-[#ad9c80]"
                    enabledColor="text-[#7a5d3f]"
                    disabledColor="text-[#b7a181]"
                    bgClass="bg-transparent"
                />
            </div>
            <GoodsValueStrip />
            <DefaultTabs
                fontClass="gap-1.5 indonesia-tab-title uppercase tracking-[0.08em]"
                activeTabClass="py-1 px-2 border-b-2 border-[#7a5d3f] text-[#5e3f27] rounded-none"
                inactiveTabClass="py-1 px-2 border-b-2 border-transparent text-[#9c7f61] hover:text-[#6f5135] hover:border-[#c8b398] rounded-none"
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
                <Header />
                {#if gameSession.gameState.result}
                    <!-- <GameEndPanel /> -->
                {:else}
                    <ActionPanel />
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

    :global(.indonesia-tab-title) {
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
    }
</style>
