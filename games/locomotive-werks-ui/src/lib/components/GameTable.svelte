<script lang="ts">
    import {
        DefaultTableLayout,
        CustomFont,
        GameSession,
        GameChat,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import type { HydratedLwGameState, LwProjectedState } from '@tabletop/locomotive-werks'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { LwGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import LibreBaskervilleFont from '$lib/fonts/LibreBaskerville.woff2'
    import LibreBaskervilleItalicFont from '$lib/fonts/LibreBaskerville-Italic.woff2'
    import PlayfairFont from '$lib/fonts/PlayfairDisplay-BlackItalic.woff2'
    import AbrilFont from '$lib/fonts/AbrilFatface.woff2'

    let { gameSession }: { gameSession: GameSession<LwProjectedState, HydratedLwGameState> } =
        $props()
    assert(gameSession instanceof LwGameSession, 'Locomotive Werks needs its own session')
    setGameSession(gameSession)
</script>

{#snippet actionControls()}
    <div class="action-area">
        {#if gameSession.gameState.result}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
    </div>
{/snippet}

<CustomFont
    fontFamily="LW Baskerville"
    url={LibreBaskervilleFont}
    format="woff2"
    fontWeight="400 700"
/>
<CustomFont
    fontFamily="LW Baskerville"
    url={LibreBaskervilleItalicFont}
    format="woff2"
    fontWeight="400 700"
    fontStyle="italic"
/>
<CustomFont fontFamily="LW Playfair" url={PlayfairFont} format="woff2" fontWeight="900" />
<CustomFont fontFamily="LW Abril" url={AbrilFont} format="woff2" fontWeight="400" />

<div class="bg-[#b9c7cf]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#232d36]"
                disabledColor="text-[#7f8d96]"
                borderClass="border-[#232d36] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#232d36]"
                    disabledColor="text-[#7f8d96]"
                    borderClass="rounded-lg border-2 border-[#232d36]"
                />
            </div>
            <DefaultTabs
                playersTitle="Engineers"
                activeTabClass="py-1 px-3 bg-[#25303a] border-2 border-transparent rounded-lg text-[#dbe3ea]"
                inactiveTabClass="text-[#232d36] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#232d36]"
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
            <div class="table-column">
                <div class="shrink-0">
                    <Header />
                    {@render actionControls()}
                </div>
                <!-- The board fills the column's width and scrolls under its frozen banner. -->
                <div class="board-scroll" onscroll={() => gameSession.closeBoardPickers()}>
                    <Board />
                </div>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .action-area {
        margin: 0 8px;
        border: 2px solid #232d36;
        border-radius: 12px;
        background: #e9eef2;
        box-shadow: 0 2px 6px rgba(16, 28, 40, 0.18);
    }

    .table-column {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .board-scroll {
        flex: 1;
        min-height: 40dvh;
        overflow-x: hidden;
        overflow-y: auto;
        margin-top: 8px;
        padding: 0 8px;
        overscroll-behavior: contain;
    }
</style>
