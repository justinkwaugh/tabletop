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
    import type { HydratedYinshGameState, YinshGameState } from '@tabletop/yinsh'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import { YinshGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<YinshGameState, HydratedYinshGameState> } =
        $props()
    assert(gameSession instanceof YinshGameSession, 'YINSH needs its own game session')
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

<div class="yinsh-table">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <!-- Faded controls in a pale steel blue that still shows on white. -->
            <HistoryControls
                enabledColor="text-[#0d1626]"
                disabledColor="text-[#a9bac8]"
                borderClass="border-b border-[#dbe4eb]"
                bgClass="bg-white shadow-[0_2px_8px_rgb(13_22_38/0.18)]"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#0d1626]"
                    disabledColor="text-[#a9bac8]"
                    borderClass="rounded-lg border border-[rgb(13_22_38/0.1)]"
                    bgClass="rounded-lg bg-white shadow-[0_2px_8px_rgb(13_22_38/0.18)]"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-[#f1ece0] border-2 border-transparent rounded-lg text-[#0c1830]"
                inactiveTabClass="text-(--yinsh-table-ink) py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#34507a]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-[#45577a]"
                        messageTextColor="text-[#0d1626]"
                        composerTextColor="text-[#0d1626]"
                        messageHoverColor="hover:bg-[#eef3f7]"
                        bgColor="bg-white shadow-[0_2px_8px_rgb(13_22_38/0.18)]"
                        inputBgColor="bg-[#f4f7fa]"
                        inputBorderColor="border-[#c5d3de]"
                        borderColor="border-[#dbe4eb]"
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
                            class="pointer-events-auto absolute top-1 right-3 z-10 flex flex-col items-end gap-1.5"
                        >
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
    .yinsh-table {
        position: relative;
        isolation: isolate;
        background: radial-gradient(
            ellipse at 50% 35%,
            var(--yinsh-table) 0%,
            var(--yinsh-table-deep) 100%
        );
        background-attachment: fixed;
        color: var(--yinsh-ink);
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--yinsh-panel);
        box-shadow:
            inset 0 0 0 1px var(--yinsh-panel-edge),
            var(--yinsh-panel-shadow);
    }

    .fullscreen-backdrop {
        background: var(--yinsh-table-deep);
        position: fixed;
        inset: 0;
        z-index: -2;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
