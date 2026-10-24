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
    import type { HydratedZertzGameState, ZertzGameState } from '@tabletop/zertz'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import { ZertzGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<ZertzGameState, HydratedZertzGameState> } =
        $props()
    assert(gameSession instanceof ZertzGameSession, 'ZÈRTZ needs its own game session')
    setGameSession(gameSession)

    const TOGGLE_ROOM = 40

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

<div class="zertz-table zertz-water" class:rippled={gameSession.rippleWater}>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#f4efe4]"
                disabledColor="text-[#5d8aa6]"
                borderClass="border-[#2f74a0] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#f4efe4]"
                    disabledColor="text-[#5d8aa6]"
                    borderClass="rounded-lg border-2 border-[#2f74a0]"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-[#f1ece0] border-2 border-transparent rounded-lg text-[#0a3554]"
                inactiveTabClass="text-[#f4efe4] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#2f74a0]"
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
                        bgColor="bg-[#0a3554]"
                        inputBgColor="bg-[#0a3554]"
                        inputBorderColor="border-[#2f74a0]"
                        borderColor="border-[#2f74a0]"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                {@render turnControls()}
            </div>
            <div
                class="relative isolate grow-0 overflow-hidden pt-2"
                style="flex:1; min-height: 40dvh;"
            >
                {#if gameSession.rippleWater}
                    <div
                        class="zertz-ripples pointer-events-none absolute inset-0 -z-10"
                        aria-hidden="true"
                    ></div>
                {/if}
                <ScalingWrapper
                    justify="center"
                    controls="bottom-left"
                    maxScale={4}
                    maxFitScale={2.5}
                    insetTop={TOGGLE_ROOM}
                    renderAtViewScale
                    expandable
                >
                    <Board />
                    {#snippet overlay()}
                        <div class="pointer-events-auto absolute top-1 right-3 z-10">
                            <div class="flex flex-col items-end gap-1.5">
                                <div class="flex gap-1.5">
                                    <OverlayToggle
                                        glyph="A1"
                                        label="Coordinates"
                                        pressed={gameSession.showCoordinates}
                                        onToggle={() => gameSession.toggleCoordinates()}
                                    />
                                    <OverlayToggle
                                        glyph="∠"
                                        label="Tilt"
                                        pressed={gameSession.tiltedBoard}
                                        onToggle={() => gameSession.toggleTiltedBoard()}
                                    />
                                </div>
                                <OverlayToggle
                                    glyph="≈"
                                    label="Ripples"
                                    pressed={gameSession.rippleWater}
                                    onToggle={() => gameSession.toggleRippleWater()}
                                />
                            </div>
                        </div>
                    {/snippet}
                    {#snippet toolbar()}
                        <!-- Full screen is a modal dialog, so the turn controls must come inside it. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                <!-- The dialog paints its own dim backdrop, so full screen needs the water redrawn behind the board. -->
                                <div
                                    class="fullscreen-water zertz-water"
                                    class:rippled={gameSession.rippleWater}
                                    aria-hidden="true"
                                >
                                    {#if gameSession.rippleWater}
                                        <div class="zertz-ripples h-full w-full"></div>
                                    {/if}
                                </div>
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
    .zertz-table {
        color: var(--zertz-ink);
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--zertz-panel);
        box-shadow: inset 0 0 0 1px var(--zertz-panel-edge);
    }

    .fullscreen-water {
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
