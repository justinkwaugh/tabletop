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
    import type { HydratedTzaarGameState, TzaarGameState } from '@tabletop/tzaar'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import { TzaarGameSession } from '$lib/model/session.svelte.js'
    import { PIECE_MODEL, ROTATED_PIECE_MODEL } from '$lib/board/pieceGeometry.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<TzaarGameState, HydratedTzaarGameState> } =
        $props()
    assert(gameSession instanceof TzaarGameSession, 'TZAAR needs its own game session')
    setGameSession(gameSession)

    // The height stacks shrink to, which the stack limit's hint names.
    const stackLimit = $derived(
        gameSession.rotatedBoard ? ROTATED_PIECE_MODEL.cap : PIECE_MODEL.cap
    )

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

<div class="tzaar-table">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <!-- Faded controls in a colour that still shows on the panels. -->
            <HistoryControls
                enabledColor="text-(--tzaar-ink)"
                disabledColor="text-(--tzaar-control-off)"
                borderClass="border-b border-(--tzaar-panel-edge)"
                bgClass="bg-(--tzaar-panel) shadow-(--tzaar-panel-shadow)"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-(--tzaar-ink)"
                    disabledColor="text-(--tzaar-control-off)"
                    borderClass="rounded-lg border border-(--tzaar-panel-edge)"
                    bgClass="rounded-lg bg-(--tzaar-panel) shadow-(--tzaar-panel-shadow)"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 max-sm:[&_svg]:hidden bg-(--tzaar-panel) shadow-(--tzaar-panel-shadow) border-2 border-transparent rounded-lg text-(--tzaar-ink)"
                inactiveTabClass="text-(--tzaar-table-ink) py-1 px-3 max-sm:[&_svg]:hidden rounded-lg border-2 border-transparent hover:border-[rgb(60_40_0/0.25)]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-(--tzaar-ink-quiet)"
                        messageTextColor="text-(--tzaar-ink)"
                        composerTextColor="text-(--tzaar-ink)"
                        messageHoverColor="hover:bg-(--tzaar-panel-hover)"
                        bgColor="bg-(--tzaar-panel) shadow-(--tzaar-panel-shadow)"
                        inputBgColor="bg-(--tzaar-panel-inset)"
                        inputBorderColor="border-(--tzaar-panel-rule)"
                        borderColor="border-(--tzaar-panel-edge)"
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
                                glyph="90°"
                                label="Rotated board"
                                hint={gameSession.rotatedBoard
                                    ? 'Turn the board back, points toward the players'
                                    : 'Turn the board a quarter turn, flat sides toward the players'}
                                pressed={gameSession.rotatedBoard}
                                onToggle={() => gameSession.toggleRotatedBoard()}
                            />
                            <!-- Half a turn round, so what tall stacks hide comes in front. -->
                            <OverlayToggle
                                label="Far side"
                                hint={gameSession.turned
                                    ? 'See the board from your own side again'
                                    : 'See the board from the far side, to see what tall stacks hide'}
                                pressed={gameSession.turned}
                                onToggle={() => gameSession.toggleTurned()}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="-8 -8 16 16"
                                    aria-hidden="true"
                                >
                                    <path d="M -5.5 -1 A 5.5 5.5 0 0 1 4.5 -3.2" class="line"
                                    ></path>
                                    <path d="M 2 -5 L 4.8 -3 L 2.2 -0.8" class="line"></path>
                                    <path d="M 5.5 1 A 5.5 5.5 0 0 1 -4.5 3.2" class="line"></path>
                                    <path d="M -2 5 L -4.8 3 L -2.2 0.8" class="line"></path>
                                </svg>
                            </OverlayToggle>
                            <!-- Tall stacks shrink to the full height unless a player would
                                 rather see them whole and turn the board to see past them. -->
                            <OverlayToggle
                                label="Stack limit"
                                hint={gameSession.shrinkStacks
                                    ? `Show tall stacks whole, instead of shrinking them past ${stackLimit} pieces`
                                    : `Shrink stacks past ${stackLimit} pieces, to see what is behind them`}
                                pressed={gameSession.shrinkStacks}
                                onToggle={() => gameSession.toggleShrinkStacks()}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="-8 -8 16 16"
                                    aria-hidden="true"
                                >
                                    <path d="M -5 5 H 5 M -5 2 H 5 M -5 -1 H 5" class="line"></path>
                                    <path d="M -6.5 -5 H 6.5" class="line"></path>
                                    <path d="M -2 -7.5 L 0 -5.5 L 2 -7.5" class="line"></path>
                                </svg>
                            </OverlayToggle>
                            <OverlayToggle
                                glyph="A1"
                                label="Coordinates"
                                hint={gameSession.showCoordinates
                                    ? 'Hide the coordinates'
                                    : 'Show the coordinates round the board'}
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
    .tzaar-table {
        position: relative;
        isolation: isolate;
        background: radial-gradient(
            ellipse at 55% 40%,
            var(--tzaar-table-glow) 0%,
            var(--tzaar-table) 45%,
            var(--tzaar-table-deep) 100%
        );
        background-attachment: fixed;
        color: var(--tzaar-table-ink);
    }

    /* DefaultTableLayout leaves a tenth of a phone screen showing the sidebar's edge.
       The history controls sit above the table there, so the board takes all but a
       sliver of the narrower player cards; the tabs drop their icons to fit. */
    @media (width < 40rem) {
        .tzaar-table :global(.game-column.game-column) {
            min-width: calc(100vw - 20px);
        }

        .tzaar-table :global(div:has(+ .game-column)) {
            width: 260px;
            min-width: 260px;
        }
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--tzaar-panel);
        box-shadow:
            inset 0 0 0 1px var(--tzaar-panel-edge),
            var(--tzaar-panel-shadow);
    }

    .fullscreen-backdrop {
        background: var(--tzaar-table-deep);
        position: fixed;
        inset: 0;
        z-index: -2;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
