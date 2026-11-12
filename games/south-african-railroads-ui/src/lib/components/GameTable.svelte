<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
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
    import type { HydratedSarGameState, SarGameState } from '@tabletop/south-african-railroads'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import ActionBoxes from '$lib/components/ActionBoxes.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import RailroadsPanel from '$lib/components/RailroadsPanel.svelte'
    import RulesDialog from '$lib/components/RulesDialog.svelte'
    import SettlementPicker from '$lib/components/board/SettlementPicker.svelte'
    import { railroadPaneOnRight } from '$lib/utils/tableLayout.svelte.js'
    import { SarGameSession } from '$lib/model/session.svelte'
    import { getGameSession, setGameSession } from '$lib/model/sessionContext.svelte'
    import LibreBaskervilleFont from '$lib/fonts/LibreBaskerville.woff2'
    import LibreBaskervilleItalicFont from '$lib/fonts/LibreBaskerville-Italic.woff2'
    import BitterFont from '$lib/fonts/Bitter.woff2'
    import OswaldFont from '$lib/fonts/Oswald.woff2'

    let { gameSession }: { gameSession: GameSession<SarGameState, HydratedSarGameState> } = $props()
    assert(gameSession instanceof SarGameSession, 'South African Railroads needs its own session')
    setGameSession(gameSession)
    const sarSession = getGameSession()

    // The shared wrapper exposes full screen only as its dialog becoming modal.
    let expanded = $state(false)
    const watchExpansion: Attachment<HTMLElement> = (node) => {
        const dialog = node.closest('dialog')
        if (!dialog) return
        const read = () => {
            expanded = dialog.matches(':modal')
        }
        const observer = new MutationObserver(read)
        observer.observe(dialog, { attributes: true, attributeFilter: ['role'] })
        read()
        return () => observer.disconnect()
    }
</script>

{#snippet turnControls()}
    <Header />
    {@render actionControls()}
{/snippet}

{#snippet actionControls()}
    <div class="action-area">
        {#if gameSession.gameState.result}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
    </div>
    {#if !gameSession.gameState.result}
        <ActionBoxes />
    {/if}
{/snippet}

<CustomFont
    fontFamily="SAR Baskerville"
    url={LibreBaskervilleFont}
    format="woff2"
    fontWeight="400 700"
/>
<CustomFont
    fontFamily="SAR Baskerville"
    url={LibreBaskervilleItalicFont}
    format="woff2"
    fontWeight="400 700"
    fontStyle="italic"
/>
<CustomFont fontFamily="SAR Bitter" url={BitterFont} format="woff2" fontWeight="100 900" />
<CustomFont fontFamily="SAR Oswald" url={OswaldFont} format="woff2" fontWeight="200 700" />

<div class="bg-[#d9dfe3]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#1f2d3d]"
                disabledColor="text-[#c4ad84]"
                borderClass="border-[#1f2d3d] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#1f2d3d]"
                    disabledColor="text-[#c4ad84]"
                    borderClass="rounded-lg border-2 border-[#1f2d3d]"
                />
            </div>
            <DefaultTabs
                playersTitle="Investors"
                activeTabClass="py-1 px-3 bg-[#1f2d3d] border-2 border-transparent rounded-lg text-[#fdfdfb]"
                inactiveTabClass="text-[#1f2d3d] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#1f2d3d]"
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
                </div>
                <div class="split">
                    <div class="play">
                        <div class="shrink-0">
                            {@render actionControls()}
                        </div>
                        <div
                            class="relative grow-0 overflow-hidden pt-2"
                            style="flex:1; min-height: 40dvh;"
                        >
                            <!-- Zooming may go past the board's own size, to read a crowded corner. -->
                            <ScalingWrapper
                                justify="center"
                                controls="bottom-left"
                                maxScale={2.5}
                                renderAtViewScale
                                expandable
                            >
                                <Board />
                                {#snippet toolbar()}
                                    <!-- Full screen is a modal dialog, so the turn controls must come inside it. -->
                                    <div {@attach watchExpansion}>
                                        {#if expanded}
                                            <div class="fullscreen-controls">
                                                {@render turnControls()}
                                            </div>
                                            {#if sarSession.rulesOpen}
                                                <RulesDialog />
                                            {/if}
                                        {/if}
                                        <!-- Outside the board's CSS zoom, which would shrink and misplace the picker. -->
                                        <SettlementPicker />
                                    </div>
                                {/snippet}
                            </ScalingWrapper>
                            {#if sarSession.rulesOpen && !expanded}
                                <RulesDialog />
                            {/if}
                        </div>
                    </div>
                    {#if railroadPaneOnRight.current}
                        <aside class="ledger" aria-label="Railroads">
                            <RailroadsPanel />
                        </aside>
                    {/if}
                </div>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .action-area {
        margin: 0 8px;
        border: 2px solid #1f2d3d;
        border-radius: 12px;
        background: #fdfdfb;
        box-shadow: 0 2px 6px rgba(16, 22, 30, 0.18);
    }

    .table-column {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .split {
        display: flex;
        flex: 1;
        gap: 8px;
        min-height: 0;
    }

    .play {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
    }

    .ledger {
        flex: none;
        width: 280px;
        overflow-y: auto;
        padding: 0 2px 8px;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
        background: #d9dfe3;
    }
</style>
