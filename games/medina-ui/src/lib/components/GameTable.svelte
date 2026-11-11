<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import {
        CustomFont,
        DefaultTableLayout,
        DefaultTabs,
        GameChat,
        GameSession,
        HistoryControls,
        ScalingWrapper
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import type { HydratedMedinaGameState, MedinaProjectedState } from '@tabletop/medina'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import Header from '$lib/components/Header.svelte'
    import History from '$lib/components/History.svelte'
    import BoardPerspectiveToggle from '$lib/components/BoardPerspectiveToggle.svelte'
    import PalaceTag from '$lib/components/PalaceTag.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import { MedinaGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import Kufam700 from '$lib/fonts/Kufam-700.woff2'
    import YesevaOne400 from '$lib/fonts/YesevaOne-400.woff2'
    import AlegreyaSans400 from '$lib/fonts/AlegreyaSans-400.woff2'
    import AlegreyaSans500 from '$lib/fonts/AlegreyaSans-500.woff2'
    import AlegreyaSans700 from '$lib/fonts/AlegreyaSans-700.woff2'
    import frieze from '$lib/images/frieze.svg'
    import zellige from '$lib/images/zellige.svg'

    let {
        gameSession
    }: { gameSession: GameSession<MedinaProjectedState, HydratedMedinaGameState> } = $props()
    assert(gameSession instanceof MedinaGameSession, 'Medina needs its own game session')
    setGameSession(gameSession)

    const ALWAYS_FIT_WIDTH = Number.POSITIVE_INFINITY

    const INITIAL_VIEW_SCALE = 1

    let scaling: ScalingWrapper | undefined = $state()
    let restedAtTopRow = false

    // The fitted phone board overflows the view, so it starts with its row of tiles showing.
    const restAtTopRow: Attachment<HTMLElement> = () => {
        if (restedAtTopRow || !scaling || !gameSession.projection.sideways) return
        if (scaling.viewScale() === INITIAL_VIEW_SCALE) return
        restedAtTopRow = true
        const wrapper = scaling
        untrack(() => wrapper.revealRect({ x: 0, y: 0, width: 1, height: 1 }))
    }

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
    <div class="plank" style:--frieze={`url("${frieze}")`}>
        <Header />
        {#if gameSession.gameState.result}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
    </div>
{/snippet}

<CustomFont fontFamily="Medina Numerals" url={YesevaOne400} format="woff2" />
<CustomFont fontFamily="Medina Display" url={Kufam700} format="woff2" fontWeight="400 900" />
<CustomFont fontFamily="Medina Body" url={AlegreyaSans400} format="woff2" fontWeight="400" />
<CustomFont fontFamily="Medina Body" url={AlegreyaSans500} format="woff2" fontWeight="500" />
<CustomFont fontFamily="Medina Body" url={AlegreyaSans700} format="woff2" fontWeight="700" />

<svg width="0" height="0" class="defs" aria-hidden="true">
    <defs>
        <clipPath id="medina-arch-58">
            <path d="M13 58V37C7 22 18 9 33 9S59 22 53 37V58z"></path>
        </clipPath>
    </defs>
</svg>

<div class="medina-table" style:background-image={`url("${zellige}")`}>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#e6c595]"
                disabledColor="text-[#47332a]"
                borderClass="border-[#e6c595] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#e6c595]"
                    disabledColor="text-[#47332a]"
                    borderClass="rounded-md border-2 border-[#e6c595]"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-[#231610] border-2 border-transparent rounded-md text-[#e6c595]"
                inactiveTabClass="text-[#b39a76] py-1 px-3 rounded-md border-2 border-transparent hover:border-[#47332a]"
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
                        bgColor="bg-black"
                        inputBgColor="bg-black"
                        inputBorderColor="border-gray-500"
                        borderColor="border-gray-500"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                {@render turnControls()}
            </div>
            <div class="board-area" {@attach restAtTopRow}>
                <ScalingWrapper
                    bind:this={scaling}
                    justify="center"
                    controls="bottom-left"
                    expandable
                    coverBelowScale={gameSession.projection.sideways && !expanded
                        ? ALWAYS_FIT_WIDTH
                        : undefined}
                    onManualViewChange={() => gameSession.focusPalace(undefined)}
                >
                    <Board />
                    {#snippet overlay(container)}
                        <BoardPerspectiveToggle />
                        <PalaceTag {container} />
                    {/snippet}
                    {#snippet toolbar()}
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                {@render turnControls()}
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .defs {
        position: absolute;
    }

    .medina-table {
        background-color: #12313b;
        background-size: 96px 96px;
    }

    .plank {
        position: relative;
        z-index: 2;
        background: #c8935a;
        color: #2a1609;
    }

    .plank::after {
        content: '';
        position: absolute;
        top: 100%;
        right: 0;
        left: 0;
        height: 9px;
        background: var(--frieze) repeat-x 0 0 / 26px 9px;
        pointer-events: none;
    }

    .board-area {
        flex: 1;
        min-height: 40dvh;
        overflow: hidden;
        padding-top: 12px;
    }
</style>
