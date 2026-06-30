<script lang="ts">
    import {
        DefaultTableLayout,
        HistoryControls,
        DefaultTabs,
        GameChat,
        GameSession
    } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/santiago'
    import { setGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import type { SantiagoGameSession } from '$lib/stores/SantiagoGameSession.svelte.js'
    import type { SantiagoGameState, HydratedSantiagoGameState } from '@tabletop/santiago'
    import Board from './Board.svelte'
    import ActionPanel from './ActionPanel.svelte'
    import ActionToolbar from './ActionToolbar.svelte'
    import WaitingPanel from './WaitingPanel.svelte'
    import PlayersPanel from './PlayersPanel.svelte'
    import History from './History.svelte'
    import { fieldImageUrl } from '$lib/utils/cropImages.js'

    let {
        gameSession
    }: { gameSession: GameSession<SantiagoGameState, HydratedSantiagoGameState> } = $props()

    // svelte-ignore state_referenced_locally
    setGameSession(gameSession as SantiagoGameSession)

    const session = $derived(gameSession as SantiagoGameSession)
    const state = $derived(session.gameState)
    const isMyTurn = $derived(session.isMyTurn)
    const isEndOfGame = $derived(state.machineState === MachineState.EndOfGame)
    const isBidding = $derived(state.machineState === MachineState.Bidding)
    const isPlanting = $derived(state.machineState === MachineState.PlantingPhase)
    const myId = $derived(session.myPlayer?.id)
    const isMyPlantTurn = $derived(isPlanting && state.plantersOrder?.[state.planterIndex] === myId)
    const isMySelectTurn = $derived(isMyPlantTurn && !state.currentPlantingTile)
    const isMyPlaceTurn = $derived(isMyPlantTurn && !!state.currentPlantingTile)
    const revealedTiles = $derived(
        (isBidding || isPlanting) ? state.revealedTiles ?? [] : []
    )

    let cellPxW = $state(0)
    let cellPxH = $state(0)
    let boardPxW = $state(0)
    let gameAreaHeight = $state(0)
    let toolbarAreaHeight = $state(0)
    let tilesAreaHeight = $state(0)
    let selectedTileIndex = $state(-1)

    $effect(() => { if (isMySelectTurn) selectedTileIndex = -1 })

    const displayTiles = $derived.by(() => {
        const base = revealedTiles.map((tile) => ({ tile, isSelected: false }))
        if (!state.currentPlantingTile) return base
        const idx = selectedTileIndex >= 0 ? selectedTileIndex : base.length
        const result = [...base]
        result.splice(idx, 0, { tile: state.currentPlantingTile, isSelected: true })
        return result
    })
    const boardMaxHeight = $derived(
        gameAreaHeight > 0
            ? Math.max(100, gameAreaHeight - toolbarAreaHeight - tilesAreaHeight - 8)
            : 0
    )

    function phaseName(ms: MachineState): string {
        switch (ms) {
            case MachineState.Bidding:          return 'Bidding'
            case MachineState.PlantingPhase:    return 'Planting'
            case MachineState.CanalBuilding:    return 'Canal Building'
            case MachineState.ExtraIrrigation:  return 'Extra Irrigation'
            case MachineState.EndOfGame:        return 'Game Over'
            default:                            return ms
        }
    }

    const playerName = (id: string) =>
        session.game?.players.find((p) => p.id === id)?.name ?? id
</script>

<style>
@keyframes tile-glow {
    0%, 100% { box-shadow: 0 0 4px 2px rgba(251, 191, 36, 0.4); }
    50%       { box-shadow: 0 0 12px 5px rgba(251, 191, 36, 0.85); }
}
.tile-selected-glow {
    animation: tile-glow 1.4s ease-in-out infinite;
}
</style>

<div class="bg-[#a05530]" style="--chat-height-offset: 0px">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                borderClass="border-amber-800 border-b-2"
                enabledColor="text-amber-300"
                disabledColor="text-amber-900"
            />
        {/snippet}

        {#snippet sideContent()}
<div class="max-sm:hidden shrink-0">
                <HistoryControls
                    borderClass="rounded-lg border-2 border-amber-800"
                    enabledColor="text-amber-300"
                    disabledColor="text-amber-900"
                    height="h-[56px]"
                />
            </div>

            <DefaultTabs
                activeTabClass="py-1 px-3 bg-amber-800 border-2 border-transparent rounded-lg text-amber-100 text-sm"
                inactiveTabClass="text-amber-400 py-1 px-3 rounded-lg border-2 border-transparent hover:border-amber-700 text-sm"
            >
                {#snippet playersPanel()}
                    {#if isEndOfGame}
                        <div class="border-b border-gray-700/60 p-2">
                            <ActionPanel />
                        </div>
                    {:else if !isMyTurn}
                        <div class="border-b border-gray-700/60 p-2">
                            <WaitingPanel />
                        </div>
                    {/if}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-amber-600"
                        bgColor="bg-stone-900"
                        inputBgColor="bg-amber-900"
                        inputBorderColor="border-stone-900"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}

        {#snippet gameContent()}
            <div bind:clientHeight={gameAreaHeight} class="h-full flex flex-col gap-1">
            <div bind:clientHeight={toolbarAreaHeight} style={boardPxW ? `max-width: ${boardPxW}px` : ''}>
                <ActionToolbar />
            </div>
            <!-- Board fills available width; fields shown below during bidding and tile selection -->
            <Board bind:cellPxW bind:cellPxH bind:boardPxW maxHeight={boardMaxHeight} />
            {#if displayTiles.length > 0}
                <div bind:clientHeight={tilesAreaHeight} class="px-3 pt-2 space-y-1.5" style={boardPxW ? `max-width: ${boardPxW}px` : ''}>
                    <div class="flex items-center justify-between">
                        <p class="text-xs text-amber-400 uppercase tracking-wide">
                            {isBidding ? 'Fields up for auction' : 'Choose a field'}
                        </p>
                        <span class="text-xs text-amber-400">{state.tileBag.length} tiles remaining</span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        {#each displayTiles as { tile, isSelected }, i}
                            {#if isSelected}
                                <div class="rounded-md overflow-hidden tile-selected-glow shrink-0"
                                     style="width:{cellPxW || 48}px; height:{cellPxH || 48}px">
                                    <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                         alt={tile.crop}
                                         class="w-full h-full object-cover" />
                                </div>
                            {:else if isMySelectTurn || isMyPlaceTurn}
                                <button
                                    onclick={() => {
                                        const revIdx = selectedTileIndex >= 0 && i > selectedTileIndex ? i - 1 : i
                                        selectedTileIndex = i
                                        session.selectTile(revIdx)
                                    }}
                                    class="rounded-md overflow-hidden transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                    style="width:{cellPxW || 48}px; height:{cellPxH || 48}px"
                                >
                                    <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                         alt={tile.crop}
                                         class="w-full h-full object-cover"
                                         style="filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
                                </button>
                            {:else}
                                <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                     alt={tile.crop}
                                     class="rounded-md object-cover"
                                     style="width:{cellPxW || 48}px; height:{cellPxH || 48}px; filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
                            {/if}
                        {/each}
                    </div>
                </div>
            {/if}
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
