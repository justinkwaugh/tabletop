<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import {
        DefaultTableLayout,
        DefaultTabs,
        GameChat,
        GameSession,
        HistoryControls,
        ScalingWrapper
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import type { HydratedLyngkGameState, LyngkGameState } from '@tabletop/lyngk'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import ColorStrip from '$lib/components/ColorStrip.svelte'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import { LyngkGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<LyngkGameState, HydratedLyngkGameState> } =
        $props()
    assert(gameSession instanceof LyngkGameSession, 'LYNGK needs its own game session')
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
    <div class="action-card">
        {#if gameSession.gameState.result && !gameSession.isViewingHistory}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
    </div>
    <ColorStrip />
{/snippet}

<div class="lyngk-table">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#f6f0e3]"
                disabledColor="text-[#8c7d66]"
                borderClass="border-[#75664f] border-b-2"
                bgClass="bg-[#3b3329]"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#f6f0e3]"
                    disabledColor="text-[#8c7d66]"
                    borderClass="rounded-lg border-2 border-[#75664f]"
                    bgClass="rounded-lg bg-[#3b3329]"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-[#fbf9f3] border-2 border-transparent rounded-lg text-[#2a2519] shadow-sm"
                inactiveTabClass="text-(--lyngk-table-ink) py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#b4ac98]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-gray-400"
                        bgColor="bg-[#3b3329]"
                        inputBgColor="bg-[#2e2820]"
                        inputBorderColor="border-[#75664f]"
                        borderColor="border-[#75664f]"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                {@render turnControls()}
            </div>
            <div class="grow-0 overflow-hidden pt-2" style="flex:1; min-height: 40dvh;">
                <ScalingWrapper
                    justify="center"
                    controls="bottom-left"
                    maxScale={4}
                    maxFitScale={2.5}
                    renderAtViewScale
                    expandable
                >
                    <Board />
                    {#snippet overlay()}
                        <div class="pointer-events-auto absolute top-1 right-3 z-10">
                            <OverlayToggle
                                glyph="A1"
                                label="Coordinates"
                                pressed={gameSession.showCoordinates}
                                onToggle={() => gameSession.toggleCoordinates()}
                            />
                        </div>
                    {/snippet}
                    {#snippet toolbar()}
                        <!-- Full screen is a modal dialog, so the turn controls must come inside it. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                <!-- The dialog paints its own dim backdrop, so full screen redraws the table behind the board. -->
                                <div class="fullscreen-backdrop" aria-hidden="true"></div>
                                <div class="fullscreen-controls">
                                    {@render turnControls()}
                                </div>
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .lyngk-table {
        background: radial-gradient(
            ellipse at 50% 35%,
            var(--lyngk-table) 0%,
            var(--lyngk-table-deep) 100%
        );
        background-attachment: fixed;
        color: var(--lyngk-ink);
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--lyngk-panel);
        box-shadow: inset 0 0 0 1px var(--lyngk-panel-edge);
    }

    .fullscreen-backdrop {
        background: var(--lyngk-table-deep);
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
