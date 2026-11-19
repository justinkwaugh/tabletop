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
    import type { HydratedYGameState, YGameState } from '@tabletop/game-of-y'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import { YGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<YGameState, HydratedYGameState> } = $props()
    assert(gameSession instanceof YGameSession, 'The Game of Y needs its own game session')
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

<div class="y-table">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <!-- Faded controls in a colour that still shows on the panels. -->
            <HistoryControls
                enabledColor="text-(--y-ink)"
                disabledColor="text-(--y-control-off)"
                borderClass="border-b border-(--y-panel-edge)"
                bgClass="bg-(--y-panel) shadow-(--y-panel-shadow)"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-(--y-ink)"
                    disabledColor="text-(--y-control-off)"
                    borderClass="rounded-lg border border-(--y-panel-edge)"
                    bgClass="rounded-lg bg-(--y-panel) shadow-(--y-panel-shadow)"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 max-sm:[&_svg]:hidden bg-(--y-panel) shadow-(--y-panel-shadow) border-2 border-transparent rounded-lg text-(--y-ink)"
                inactiveTabClass="text-(--y-table-ink) py-1 px-3 max-sm:[&_svg]:hidden rounded-lg border-2 border-transparent hover:border-[rgb(60_40_20/0.25)]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-(--y-ink-quiet)"
                        messageTextColor="text-(--y-ink)"
                        composerTextColor="text-(--y-ink)"
                        messageHoverColor="hover:bg-(--y-panel-hover)"
                        bgColor="bg-(--y-panel) shadow-(--y-panel-shadow)"
                        inputBgColor="bg-(--y-panel-inset)"
                        inputBorderColor="border-(--y-panel-rule)"
                        borderColor="border-(--y-panel-edge)"
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
                            {#if gameSession.isHexBoard}
                                <OverlayToggle
                                    label="Hexagons"
                                    pressed={gameSession.hexCells}
                                    onToggle={() => gameSession.toggleHexCells()}
                                >
                                    <!-- Two cells side by side. -->
                                    <svg
                                        viewBox="0 0 20 14"
                                        width="20"
                                        height="14"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="1.3"
                                        stroke-linejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M5.5 1.5 L9.8 4 L9.8 10 L5.5 12.5 L1.2 10 L1.2 4 Z M9.8 4 L14.1 1.5 L18.4 4 L18.4 10 L14.1 12.5 L9.8 10"
                                        ></path>
                                    </svg>
                                </OverlayToggle>
                            {/if}
                            <OverlayToggle
                                label="Flat board"
                                pressed={gameSession.flatBoard}
                                onToggle={() => gameSession.toggleFlatBoard()}
                            >
                                <!-- The board's outline seen from straight above. -->
                                <svg
                                    viewBox="0 0 16 14"
                                    width="16"
                                    height="14"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.4"
                                    stroke-linejoin="round"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M8 1.2 Q12.6 5.6 14.8 12.6 Q8 14.2 1.2 12.6 Q3.4 5.6 8 1.2 Z"
                                    ></path>
                                </svg>
                            </OverlayToggle>
                            <OverlayToggle
                                label="Loose stones"
                                pressed={gameSession.looseStones}
                                onToggle={() => gameSession.toggleLooseStones()}
                            >
                                <!-- Three stones, set a little off a line. -->
                                <svg
                                    viewBox="0 0 22 14"
                                    width="22"
                                    height="14"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.4"
                                    aria-hidden="true"
                                >
                                    <circle cx="4.6" cy="7.9" r="2.7"></circle>
                                    <circle cx="11.2" cy="6.1" r="2.7"></circle>
                                    <circle cx="17.6" cy="7.6" r="2.7"></circle>
                                </svg>
                            </OverlayToggle>
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
    .y-table {
        position: relative;
        isolation: isolate;
        background: var(--y-table);
        touch-action: manipulation;
        color: var(--y-table-ink);
    }

    /* DefaultTableLayout leaves a tenth of a phone screen showing the sidebar's edge.
       The history controls sit above the table there, so the board takes all but a
       sliver of the narrower player cards; the tabs drop their icons to fit. */
    @media (width < 40rem) {
        .y-table :global(.game-column.game-column) {
            min-width: calc(100vw - 20px);
        }

        .y-table :global(div:has(+ .game-column)) {
            width: 260px;
            min-width: 260px;
        }
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--y-panel);
        box-shadow:
            inset 0 0 0 1px var(--y-panel-edge),
            var(--y-panel-shadow);
    }

    .fullscreen-backdrop {
        background: var(--y-table-deep);
        position: fixed;
        inset: 0;
        z-index: -2;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
