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
    import type { HydratedDvonnGameState, DvonnGameState } from '@tabletop/dvonn'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import BoardStyleToggle from '$lib/components/BoardStyleToggle.svelte'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import { DvonnGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<DvonnGameState, HydratedDvonnGameState> } =
        $props()
    assert(gameSession instanceof DvonnGameSession, 'DVONN needs its own game session')
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
{/snippet}

<div class="dvonn-table">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#f7eee6]"
                disabledColor="text-[#a3685a]"
                borderClass="border-[#7d2a1f] border-b-2"
                bgClass="bg-[#2a0907]"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#f7eee6]"
                    disabledColor="text-[#a3685a]"
                    borderClass="rounded-lg border-2 border-[#7d2a1f]"
                    bgClass="rounded-lg bg-[#2a0907]"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-[#f3ebdf] border-2 border-transparent rounded-lg text-[#2a0907]"
                inactiveTabClass="text-(--dvonn-table-ink) py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#7d2a1f]"
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
                        bgColor="bg-[#2a0907]"
                        inputBgColor="bg-[#2a0907]"
                        inputBorderColor="border-[#7d2a1f]"
                        borderColor="border-[#7d2a1f]"
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
                        <div
                            class="pointer-events-auto absolute right-3 bottom-2 z-10 flex items-center gap-1.5"
                        >
                            <OverlayToggle
                                glyph="A1"
                                label="Coordinates"
                                pressed={gameSession.showCoordinates}
                                onToggle={() => gameSession.toggleCoordinates()}
                            />
                            <BoardStyleToggle />
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
    .dvonn-table {
        position: relative;
        isolation: isolate;
        background: radial-gradient(
            ellipse at 55% 40%,
            var(--dvonn-table-glow) 0%,
            var(--dvonn-table) 45%,
            var(--dvonn-table-deep) 100%
        );
        background-attachment: fixed;
        color: var(--dvonn-ink);
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--dvonn-panel);
        box-shadow: inset 0 0 0 1px var(--dvonn-panel-edge);
    }

    .fullscreen-backdrop {
        background: var(--dvonn-table-deep);
        position: fixed;
        inset: 0;
        z-index: -2;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
