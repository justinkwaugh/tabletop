<script lang="ts">
    import {
        ScalingWrapper,
        DefaultTableLayout,
        GameSession,
        GameChat,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'

    import Board from '$lib/components/Board.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import AnimationOverlay from '$lib/components/AnimationOverlay.svelte'
    import Header from '$lib/components/Header.svelte'

    import type { UrbinoGameSession } from '$lib/model/session.svelte'
    import type { HydratedUrbinoGameState, UrbinoGameState } from '@tabletop/urbino'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let { gameSession }: { gameSession: GameSession<UrbinoGameState, HydratedUrbinoGameState> } =
        $props()
    setGameSession(gameSession as UrbinoGameSession)
</script>

<AnimationOverlay />
<div class="bg-[#b0a090]" style="--chat-height-offset: 52px;">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#2c1810]"
                disabledColor="text-[#c8bfaf]"
                borderClass="border-[#c8bfaf] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls enabledColor="text-[#2c1810]" disabledColor="text-[#c8bfaf]" />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-[#6b3a2a] border-2 border-transparent rounded-lg text-gray-100"
                inactiveTabClass="text-[#2c1810] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#6b3a2a]"
                fontClass="font-normal"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-gray-500"
                        bgColor="bg-[#2c1810]"
                        inputBgColor="bg-[#2c1810]"
                        inputBorderColor="border-[#6b3a2a]"
                        borderColor="border-[#6b3a2a]"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <Header />
                {#if gameSession.gameState.result}
                    <GameEndPanel />
                {:else}
                    <ActionPanel />
                {/if}
            </div>
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <div class="flex flex-col items-center gap-2">
                        <Board />
                        <p class="text-xs text-[#3a2c1e]">Urbino — designed by Dieter Stein</p>
                    </div>
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
