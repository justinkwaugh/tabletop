<script lang="ts">
    import {
        ScalingWrapper,
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
    import LastActionBanner from './LastActionBanner.svelte'
    import WaitingPanel from './WaitingPanel.svelte'
    import PlayersPanel from './PlayersPanel.svelte'
    import History from './History.svelte'
    import { fieldImageUrl } from '$lib/utils/cropImages.js'
    import { CELL_W, CELL_H } from '$lib/utils/boardGeometry.js'
    import { useBoardCenterX } from '$lib/utils/boardCenter.svelte.js'

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
    const isNeutralPlacementMode = $derived(
        isPlanting &&
        (state.planterIndex ?? 0) >= (state.plantersOrder?.length ?? Infinity) &&
        (state.players?.length ?? 0) === 3 &&
        (state.revealedTiles?.length ?? 0) > 0
    )
    const revealedTiles = $derived(
        (isBidding || isPlanting) ? state.revealedTiles ?? [] : []
    )

    const displayTiles = $derived(
        revealedTiles.map((tile, i) => ({ tile, isSelected: i === session.selectedTileIndex }))
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

    // Tracks the board's live horizontal center (relative to the bar above it) so that
    // bar's contents can be centered over just the board rather than over the board +
    // the tile strip beside it. Board.svelte doesn't expose a bindable root element, so
    // this wraps it in a plain div below and measures via getBoundingClientRect.
    let boardEl: HTMLDivElement | undefined
    let topBarEl: HTMLDivElement | undefined
    const boardCenter = useBoardCenterX(() => boardEl, () => topBarEl)
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

<div class="bg-[#1c1410]" style="--chat-height-offset: 0px">
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
                />
            </div>

            <DefaultTabs
                activeTabClass="h-[44px] flex items-center justify-center px-3 bg-amber-800 border-2 border-transparent rounded-lg text-amber-100 text-sm"
                inactiveTabClass="h-[44px] flex items-center justify-center text-amber-400 px-3 rounded-lg border-2 border-transparent hover:border-amber-700 text-sm"
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
            <!-- Top part is not allowed to shrink -->
            <div class="shrink-0" bind:this={topBarEl}>
                <ActionToolbar boardCenterX={boardCenter.value} />
                <LastActionBanner boardCenterX={boardCenter.value} />
            </div>
            <!-- Bottom part fills the remaining space, but hides overflow to keep its height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size -->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-right">
                    <div class="w-fit">
                        <!-- ScalingWrapper (a shared library component) clips to its own
                             measured content box — CSS overflow:visible on anything inside
                             Board isn't enough, since that box is sized to the board's tight
                             bounds. This padding reserves genuine layout space around the
                             board so labels that poke out past its edges still fall inside
                             the box ScalingWrapper actually measures and doesn't clip. -->
                        <div class="pl-8 pr-8 pt-4">
                            <div class="flex items-start gap-4">
                                {#if displayTiles.length > 0}
                                    <!-- Revealed tiles (auction, selection, or neutral placement,
                                         whichever phase we're in) — a vertical strip to the
                                         board's left, top-aligned with it, for the whole round.
                                         No label: position and the toolbar's own phase hint
                                         already make it obvious what these are. mt-5 nudges the
                                         whole strip down slightly — the selected tile's glow
                                         (tile-selected-glow, a box-shadow with 12px blur + 5px
                                         spread) needs clearance above it when it's the top tile,
                                         otherwise it clips against ScalingWrapper's measured
                                         content box. Board is taller than this column, so this
                                         borrows from its already-reserved height rather than
                                         growing the row (which would re-break the board's
                                         top-edge alignment with the player panel). -->
                                    <div class="flex flex-col gap-2 shrink-0 mt-5">
                                        {#each displayTiles as { tile, isSelected }, i}
                                            {#if isSelected}
                                                <div class="rounded-md overflow-hidden tile-selected-glow shrink-0"
                                                     style="width:{CELL_W}px; height:{CELL_H}px">
                                                    <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                                         alt={tile.crop}
                                                         class="w-full h-full object-cover" />
                                                </div>
                                            {:else if isMyPlantTurn}
                                                <button
                                                    onclick={() => session.selectTile(i)}
                                                    class="rounded-md overflow-hidden transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                                    style="width:{CELL_W}px; height:{CELL_H}px"
                                                >
                                                    <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                                         alt={tile.crop}
                                                         class="w-full h-full object-cover"
                                                         style="filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
                                                </button>
                                            {:else if isNeutralPlacementMode}
                                                <div class="relative rounded-md overflow-hidden ring-2 ring-purple-400/70 shrink-0"
                                                     style="width:{CELL_W}px; height:{CELL_H}px">
                                                    <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                                         alt={tile.crop}
                                                         class="w-full h-full object-cover"
                                                         style="filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5)) grayscale(30%)" />
                                                    <div class="absolute bottom-0 inset-x-0 text-center bg-gray-800/70 text-[8px] text-gray-200 leading-tight py-px">neutral</div>
                                                </div>
                                            {:else}
                                                <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                                     alt={tile.crop}
                                                     class="rounded-md object-cover"
                                                     style="width:{CELL_W}px; height:{CELL_H}px; filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
                                            {/if}
                                        {/each}
                                        {#if state.tileBag.length > 0}
                                            <div class="relative rounded-md overflow-hidden" style="width:{CELL_W}px; height:{CELL_H}px">
                                                <img src="/desert.png" alt="tiles remaining"
                                                     class="w-full h-full object-cover"
                                                     style="filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
                                                <span class="absolute inset-0 flex items-center justify-center text-white font-black text-lg"
                                                      style="text-shadow: 0 1px 3px rgba(0,0,0,0.9)">
                                                    {state.tileBag.length}
                                                </span>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                                <div bind:this={boardEl}>
                                    <Board />
                                </div>
                            </div>
                        </div>
                    </div>
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
