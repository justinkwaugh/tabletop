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
    import type { HydratedMatrxGameState, MatrxGameState } from '@tabletop/matrx'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import ReserveStrip from '$lib/components/ReserveStrip.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { MatrxGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<MatrxGameState, HydratedMatrxGameState> } =
        $props()
    assert(gameSession instanceof MatrxGameSession, 'MATRX GIPF needs its own game session')
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

<div class="matrx-table">
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
    .matrx-table {
        background: radial-gradient(
            ellipse at 50% 35%,
            var(--matrx-table) 0%,
            var(--matrx-table-deep) 100%
        );
        background-attachment: fixed;
        color: var(--matrx-ink);
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--matrx-panel);
        box-shadow:
            inset 0 0 0 1px var(--matrx-panel-edge),
            0 2px 6px rgb(0 0 0 / 0.08);
    }

    .fullscreen-backdrop {
        background: var(--matrx-table-deep);
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
