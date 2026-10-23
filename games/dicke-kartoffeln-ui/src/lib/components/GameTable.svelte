<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import {
        ScalingWrapper,
        DefaultTableLayout,
        CustomFont,
        GameSession,
        GameChat,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import type {
        DickeKartoffelnProjectedState,
        HydratedDickeKartoffelnGameState
    } from '@tabletop/dicke-kartoffeln'
    import { DickeKartoffelnGameSession, TableView } from '$lib/model/session.svelte.js'
    import { getGameSession, setGameSession } from '$lib/model/sessionContext.svelte.js'
    import ActionPanel from './ActionPanel.svelte'
    import GameEndPanel from './GameEndPanel.svelte'
    import Header from './Header.svelte'
    import History from './History.svelte'
    import MessageDialog from './MessageDialog.svelte'
    import PlayerAid from './PlayerAid.svelte'
    import PlayersPanel from './PlayersPanel.svelte'
    import YearTrack from './YearTrack.svelte'
    import FarmView from './board/FarmView.svelte'
    import SeedPicker from './board/SeedPicker.svelte'
    import YieldSheet from './sheet/YieldSheet.svelte'
    import { compactTable } from '$lib/utils/tableLayout.svelte.js'
    import GochiHandFont from '$lib/fonts/GochiHand.woff2'
    import PatrickHandFont from '$lib/fonts/PatrickHand.woff2'
    import CaveatFont from '$lib/fonts/Caveat.woff2'
    import CourierPrimeFont from '$lib/fonts/CourierPrime-Regular.woff2'
    import DotoFont from '$lib/fonts/Doto.woff2'

    let {
        gameSession
    }: {
        gameSession: GameSession<DickeKartoffelnProjectedState, HydratedDickeKartoffelnGameState>
    } = $props()
    setGameSession(
        untrack(() => {
            assert(
                gameSession instanceof DickeKartoffelnGameSession,
                'Dicke Kartoffeln needs its own session'
            )
            return gameSession
        })
    )
    const session = getGameSession()

    const sheetPlayerId = $derived(session.sheetPlayerId ?? session.gameState.players[0].playerId)

    let wrapper: ScalingWrapper | undefined = $state()

    // A phone would otherwise rest in the middle of the tall stacked table; start at its top,
    // with the farm (or the sheet's first fields) across the screen.
    const startAtTop: Attachment<HTMLElement> = (node) => {
        const target = wrapper
        if (!compactTable.current || !target) return
        // focusRect reads the wrapper's view state; tracking it would undo every pan and pinch.
        untrack(() =>
            target.focusRect(
                { x: 0, y: 0, width: node.offsetWidth, height: 240 },
                { animate: false }
            )
        )
    }

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

<CustomFont fontFamily="Kartoffeln Letters" url={GochiHandFont} format="woff2" />
<CustomFont fontFamily="Kartoffeln Hand" url={PatrickHandFont} format="woff2" />
<CustomFont fontFamily="Kartoffeln Pen" url={CaveatFont} format="woff2" fontWeight="400 700" />
<CustomFont fontFamily="Kartoffeln Typewriter" url={CourierPrimeFont} format="woff2" />
<CustomFont fontFamily="Kartoffeln Dots" url={DotoFont} format="woff2" fontWeight="900" />

{#snippet actionControls()}
    <div class="action-area">
        <YearTrack />
        {#if session.gameState.result && !session.isViewingHistory}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
    </div>
{/snippet}

{#snippet views()}
    <div class="views" role="tablist">
        <button
            type="button"
            role="tab"
            aria-selected={session.view === TableView.Farm}
            class:selected={session.view === TableView.Farm}
            onclick={() => session.showView(TableView.Farm)}>FARMS & MARKET</button
        >
        <button
            type="button"
            role="tab"
            aria-selected={session.view === TableView.Sheet}
            class:selected={session.view === TableView.Sheet}
            onclick={() => session.showView(TableView.Sheet)}>YIELD SHEET</button
        >
    </div>
{/snippet}

<div class="kartoffeln">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#4a2c16]"
                disabledColor="text-[#b8a580]"
                borderClass="border-[#4a2c16] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#4a2c16]"
                    disabledColor="text-[#b8a580]"
                    borderClass="rounded-lg border-2 border-[#4a2c16]"
                />
            </div>
            <DefaultTabs
                playersTitle="Farmers"
                activeTabClass="py-1 px-3 bg-[#6e3b1c] border-2 border-transparent rounded-lg text-[#fff6dc]"
                inactiveTabClass="text-[#4a2c16] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#6e3b1c]"
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
            <div class="table-column">
                <div class="shrink-0">
                    <Header />
                    {@render actionControls()}
                    {@render views()}
                </div>
                <div class="board">
                    <ScalingWrapper
                        bind:this={wrapper}
                        justify="center"
                        controls="bottom-left"
                        maxScale={1.6}
                        coverBelowScale={0.45}
                        renderAtViewScale
                        expandable
                    >
                        {#if session.view === TableView.Sheet}
                            <div {@attach startAtTop}><YieldSheet playerId={sheetPlayerId} /></div>
                        {:else}
                            <div {@attach startAtTop}><FarmView /></div>
                        {/if}
                        {#snippet toolbar()}
                            <!-- Full screen is a modal dialog, so the turn controls must come inside it. -->
                            <div {@attach watchExpansion}>
                                {#if expanded}
                                    <div class="fullscreen-controls">
                                        <Header />
                                        {@render actionControls()}
                                        {@render views()}
                                    </div>
                                    {#if session.playerAidOpen}
                                        <PlayerAid />
                                    {/if}
                                {/if}
                                <!-- Outside the content's CSS zoom, which would shrink and misplace the picker. -->
                                <SeedPicker />
                            </div>
                        {/snippet}
                    </ScalingWrapper>
                    <MessageDialog />
                    {#if session.playerAidOpen && !expanded && !compactTable.current}
                        <PlayerAid />
                    {/if}
                </div>
                <!-- A phone has no room to read the aid beside the action area, so it covers that too. -->
                {#if session.playerAidOpen && !expanded && compactTable.current}
                    <PlayerAid />
                {/if}
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .kartoffeln {
        background: #c8d1b0;
    }

    .table-column {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .action-area {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0 8px;
        border: 2px solid #6e3b1c;
        border-radius: 12px;
        background: #fdf8ea;
        padding: 4px;
        box-shadow: 0 2px 6px rgba(40, 24, 8, 0.18);
    }

    .views {
        display: flex;
        justify-content: center;
        gap: 6px;
        padding: 6px 0 2px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
    }

    .views button {
        border: 2px solid #6e3b1c;
        border-radius: 999px;
        padding: 0 14px;
        color: #6e3b1c;
        font-size: 17px;
    }

    .views button.selected {
        background: #6e3b1c;
        color: #fff6dc;
    }

    .board {
        position: relative;
        flex: 1;
        min-height: 40dvh;
        overflow: hidden;
        padding-top: 4px;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
        background: #c8d1b0;
    }
</style>
