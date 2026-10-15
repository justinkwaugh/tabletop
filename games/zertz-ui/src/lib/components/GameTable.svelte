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
    import { ZertzGameSession } from '$lib/model/session.svelte.js'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<ZertzGameState, HydratedZertzGameState> } =
        $props()
    assert(gameSession instanceof ZertzGameSession, 'ZÈRTZ needs its own game session')
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

<div class="zertz-table">
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
            <div class="grow-0 overflow-hidden pt-2" style="flex:1; min-height: 40dvh;">
                <ScalingWrapper justify="center" controls="bottom-left" expandable>
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
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .zertz-table {
        background-color: var(--zertz-water-deep);
        background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='1200' viewBox='0 0 1600 1200' preserveAspectRatio='xMidYMid slice'%3E%3Cfilter id='w'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.004 0.008' numOctaves='3' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -2.4 1.25'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23w)' opacity='0.22'/%3E%3C/svg%3E"),
            radial-gradient(
                ellipse at 50% 30%,
                var(--zertz-water) 0%,
                #125f8c 45%,
                var(--zertz-water-deep) 100%
            );
        background-size: cover;
        background-repeat: no-repeat;
        background-attachment: fixed;
        color: var(--zertz-ink);
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--zertz-panel);
        box-shadow: inset 0 0 0 1px var(--zertz-panel-edge);
    }

    .fullscreen-controls {
        padding-bottom: 8px;
        background: var(--zertz-water-deep);
    }
</style>
