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
    import type { HydratedPunctGameState, PunctGameState } from '@tabletop/punct'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import ReserveStrip from '$lib/components/ReserveStrip.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { PunctGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<PunctGameState, HydratedPunctGameState> } =
        $props()
    assert(gameSession instanceof PunctGameSession, 'PÜNCT needs its own game session')
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

<div class="punct-table">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#1d2329]"
                disabledColor="text-[#a9b3be]"
                borderClass="border-[#c3cad2] border-b-2"
                bgClass="bg-[#ffffff]"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#1d2329]"
                    disabledColor="text-[#a9b3be]"
                    borderClass="rounded-lg border-2 border-[#c3cad2]"
                    bgClass="rounded-lg bg-[#ffffff] shadow-sm"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-[#ffffff] border-2 border-[#c3cad2] rounded-lg text-[#1d2329]"
                inactiveTabClass="text-[#1d2329] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#c3cad2]"
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
                        bgColor="bg-[#ffffff]"
                        inputBgColor="bg-[#ffffff]"
                        inputBorderColor="border-[#c3cad2]"
                        borderColor="border-[#c3cad2]"
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
                            <OverlayToggle
                                label="Levels"
                                pressed={gameSession.showLevels}
                                onToggle={() => gameSession.toggleLevels()}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="-8 -8 16 16"
                                    aria-hidden="true"
                                >
                                    <circle r="6.5" class="badge-ring"></circle>
                                    <text
                                        y="3.6"
                                        text-anchor="middle"
                                        font-size="10"
                                        font-weight="700">2</text
                                    >
                                </svg>
                            </OverlayToggle>
                            <OverlayToggle
                                label="Far side"
                                pressed={gameSession.preferences.values.turned}
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
    .punct-table {
        background: var(--punct-table);
        color: var(--punct-ink);
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--punct-panel);
        box-shadow:
            inset 0 0 0 1px var(--punct-panel-edge),
            0 2px 6px rgb(0 0 0 / 0.08);
    }

    .fullscreen-backdrop {
        background: var(--punct-table);
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
