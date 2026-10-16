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
    import type { HydratedRailheadsGameState, RailheadsProjectedState } from '@tabletop/railheads'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import ActionSpaces from '$lib/components/ActionSpaces.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import CompaniesPanel from '$lib/components/CompaniesPanel.svelte'
    import IndustriesPanel from '$lib/components/IndustriesPanel.svelte'
    import { companyPaneOnRight } from '$lib/utils/tableLayout.svelte.js'
    import { RailheadsGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import LibreBaskervilleFont from '$lib/fonts/LibreBaskerville.woff2'
    import LibreBaskervilleItalicFont from '$lib/fonts/LibreBaskerville-Italic.woff2'

    let {
        gameSession
    }: { gameSession: GameSession<RailheadsProjectedState, HydratedRailheadsGameState> } = $props()
    assert(gameSession instanceof RailheadsGameSession, 'Railheads needs its own session')
    setGameSession(gameSession)

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
        <ActionSpaces />
    {/if}
{/snippet}

<CustomFont
    fontFamily="Railheads Baskerville"
    url={LibreBaskervilleFont}
    format="woff2"
    fontWeight="400 700"
/>
<CustomFont
    fontFamily="Railheads Baskerville"
    url={LibreBaskervilleItalicFont}
    format="woff2"
    fontWeight="400 700"
    fontStyle="italic"
/>

<div class="bg-[#e6e2c3]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#33401a]"
                disabledColor="text-[#9d9a6d]"
                borderClass="border-[#33401a] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#33401a]"
                    disabledColor="text-[#9d9a6d]"
                    borderClass="rounded-lg border-2 border-[#33401a]"
                />
            </div>
            <DefaultTabs
                playersTitle="Investors"
                activeTabClass="py-1 px-3 bg-[#33401a] border-2 border-transparent rounded-lg text-[#f4f0d8]"
                inactiveTabClass="text-[#33401a] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#33401a]"
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
                        <div class="grow-0 overflow-hidden pt-2" style="flex:1; min-height: 40dvh;">
                            <ScalingWrapper
                                justify="center"
                                controls="bottom-left"
                                maxScale={1.6}
                                coverBelowScale={1}
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
                                        {/if}
                                    </div>
                                {/snippet}
                            </ScalingWrapper>
                        </div>
                    </div>
                    {#if companyPaneOnRight.current}
                        <aside class="ledger" aria-label="Companies and industries">
                            <CompaniesPanel />
                            <IndustriesPanel />
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
        border: 2px solid #33401a;
        border-radius: 12px;
        background: #f6f2da;
        box-shadow: 0 2px 6px rgba(40, 24, 8, 0.18);
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
        display: flex;
        flex: none;
        flex-direction: column;
        gap: 6px;
        width: 300px;
        overflow-y: auto;
        padding: 0 2px 8px;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
        background: #e6e2c3;
    }
</style>
