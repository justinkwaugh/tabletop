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
    import {
        PieceKind,
        type HydratedGipfPotentialsGameState,
        type GipfPotentialsGameState
    } from '@tabletop/gipf-potentials'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import ReserveStrip from '$lib/components/ReserveStrip.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { GipfPotentialsGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        gameSession
    }: { gameSession: GameSession<GipfPotentialsGameState, HydratedGipfPotentialsGameState> } =
        $props()
    assert(
        gameSession instanceof GipfPotentialsGameSession,
        'GIPF with Potentials needs its own game session'
    )
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
    <ReserveStrip />
{/snippet}

<div class="gp-table">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#eef2f8]"
                disabledColor="text-[#5a6f90]"
                borderClass="border-[#34507a] border-b-2"
                bgClass="bg-[#0b1730]"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#eef2f8]"
                    disabledColor="text-[#5a6f90]"
                    borderClass="rounded-lg border-2 border-[#34507a]"
                    bgClass="rounded-lg bg-[#0b1730]"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-[#f1ece0] border-2 border-transparent rounded-lg text-[#0c1830]"
                inactiveTabClass="text-[#eef2f8] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#34507a]"
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
                        bgColor="bg-[#0c1830]"
                        inputBgColor="bg-[#0c1830]"
                        inputBorderColor="border-[#34507a]"
                        borderColor="border-[#34507a]"
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
                                label="Coordinates"
                                pressed={gameSession.showCoordinates}
                                onToggle={() => gameSession.toggleCoordinates()}>A1</OverlayToggle
                            >
                            <!-- E5 is marked, though the real board is not, as a reminder of TAMSK's extra move. -->
                            {#if gameSession.kindsInPlay.includes(PieceKind.Tamsk)}
                                <OverlayToggle
                                    label="E5 mark"
                                    pressed={gameSession.centreMark}
                                    onToggle={() => gameSession.toggleCentreMark()}
                                >
                                    <svg
                                        width="16"
                                        height="12"
                                        viewBox="-8 -6 16 12"
                                        aria-hidden="true"
                                    >
                                        <ellipse rx="7" ry="5.25"></ellipse>
                                        <ellipse rx="2.6" ry="1.95"></ellipse>
                                    </svg>
                                </OverlayToggle>
                            {/if}
                            <!-- Half a turn round, so what tall stacks hide comes in front. -->
                            <OverlayToggle
                                label="Far side"
                                pressed={gameSession.turned}
                                onToggle={() => gameSession.toggleTurned()}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="-8 -8 16 16"
                                    aria-hidden="true"
                                >
                                    <path d="M -5.5 -1 A 5.5 5.5 0 0 1 4.5 -3.2" class="turn-arrow"
                                    ></path>
                                    <path d="M 2 -5 L 4.8 -3 L 2.2 -0.8" class="turn-arrow"></path>
                                    <path d="M 5.5 1 A 5.5 5.5 0 0 1 -4.5 3.2" class="turn-arrow"
                                    ></path>
                                    <path d="M -2 5 L -4.8 3 L -2.2 0.8" class="turn-arrow"></path>
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
    .gp-table {
        background: radial-gradient(
            ellipse at 50% 35%,
            var(--gp-table) 0%,
            var(--gp-table-deep) 100%
        );
        background-attachment: fixed;
        color: var(--gp-ink);
        /* Workaround: iOS holds each tap outside the board (the board's wrapper turns touch
           handling off) to see whether a second makes a double-tap zoom, so the reserve strip,
           buttons and cards answered late. Pinch zoom still works. */
        touch-action: manipulation;
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--gp-panel);
        box-shadow: inset 0 0 0 1px var(--gp-panel-edge);
    }

    .fullscreen-backdrop {
        background: var(--gp-table);
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
