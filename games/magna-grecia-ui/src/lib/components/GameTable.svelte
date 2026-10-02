<script lang="ts">
    import {
        ScalingWrapper,
        DefaultTableLayout,
        CustomFont,
        GameSession,
        GameChat,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import type {
        HydratedMagnaGreciaGameState,
        MagnaGreciaProjectedState
    } from '@tabletop/magna-grecia'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionCard from '$lib/components/ActionCard.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { MagnaGreciaGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import LibreBaskervilleFont from '$lib/fonts/LibreBaskerville.woff2'
    import LibreBaskervilleItalicFont from '$lib/fonts/LibreBaskerville-Italic.woff2'

    let {
        gameSession
    }: {
        gameSession: GameSession<MagnaGreciaProjectedState, HydratedMagnaGreciaGameState>
    } = $props()
    assert(gameSession instanceof MagnaGreciaGameSession, 'Magna Grecia needs its own game session')
    setGameSession(gameSession)
</script>

<CustomFont
    fontFamily="Libre Baskerville"
    url={LibreBaskervilleFont}
    format="woff2"
    fontWeight="400 700"
/>
<CustomFont
    fontFamily="Libre Baskerville"
    url={LibreBaskervilleItalicFont}
    format="woff2"
    fontWeight="400 700"
    fontStyle="italic"
/>

<div class="bg-[#f3ecdc]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#4a2c12]"
                disabledColor="text-[#cbb89a]"
                borderClass="border-[#8c5b2e] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls enabledColor="text-[#4a2c12]" disabledColor="text-[#cbb89a]" />
            </div>
            <DefaultTabs
                playersTitle="Settlers"
                activeTabClass="py-1 px-3 bg-[#6b3f1d] border-2 border-transparent rounded-lg text-[#fbf3dc]"
                inactiveTabClass="text-[#6b3f1d] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#6b3f1d]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-gray-500"
                        bgColor="bg-black"
                        inputBgColor="bg-black"
                        inputBorderColor="border-gray-500"
                        borderColor="border-gray-500"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <Header />
                <ActionCard>
                    {#if gameSession.gameState.result}
                        <GameEndPanel />
                    {:else}
                        <ActionPanel />
                    {/if}
                </ActionCard>
            </div>
            <div class="grow-0 overflow-hidden pt-3" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
