<script lang="ts">
    import { isNeutralPlacementStage, isPlantTurn } from '$lib/model/turnRules.js'
    import {
        ScalingWrapper,
        DefaultTableLayout,
        HistoryControls,
        DefaultTabs,
        GameChat,
        CustomFont,
        GameSession
    } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/santiago'
    import { setGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import { SantiagoGameSession } from '$lib/stores/SantiagoGameSession.svelte.js'
    import { untrack } from 'svelte'
    import type { SantiagoProjectedState, HydratedSantiagoGameState } from '@tabletop/santiago'
    import Board from './Board.svelte'
    import ActionPanel from './ActionPanel.svelte'
    import ActionToolbar from './ActionToolbar.svelte'
    import PlayerActionBar from './PlayerActionBar.svelte'
    import MoodTuner from './MoodTuner.svelte'
    import LastActionBanner from './LastActionBanner.svelte'
    import PlayersPanel from './PlayersPanel.svelte'
    import History from './History.svelte'
    import { fieldImageUrl } from '$lib/utils/cropImages.js'
    import { desertUrl } from '$lib/utils/imageUrls.js'
    import { CELL_W, CELL_H } from '$lib/utils/boardGeometry.js'
    import { useBoardCenterX } from '$lib/utils/boardCenter.svelte.js'
    import BitterFont from '$lib/fonts/Bitter.woff2'
    import LoraFont from '$lib/fonts/Lora.woff2'

    let {
        gameSession
    }: { gameSession: GameSession<SantiagoProjectedState, HydratedSantiagoGameState> } = $props()

    function ensureSantiagoGameSession(
        session: GameSession<SantiagoProjectedState, HydratedSantiagoGameState>
    ): SantiagoGameSession {
        if (session instanceof SantiagoGameSession) return session
        throw new Error('Table expected a SantiagoGameSession')
    }

    const session = untrack(() => ensureSantiagoGameSession(gameSession))
    setGameSession(session)

    const deal = session.tileDeal
    const preview = session.boardPreview
    const state = $derived(session.gameState)
    const isEndOfGame = $derived(state.machineState === MachineState.EndOfGame)
    const isBidding = $derived(state.machineState === MachineState.Bidding)
    const isPlanting = $derived(state.machineState === MachineState.PlantingPhase)
    const isMyPlantTurn = $derived(isPlantTurn(state, session.myPlayer?.id))
    const isNeutralPlacementMode = $derived(isNeutralPlacementStage(state))
    const revealedTiles = $derived(
        preview.tiles ?? ((isBidding || isPlanting) ? state.revealedTiles : [])
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
.tile-selected {
    border: 3px solid white;
    transform: scale(1.1);
    transition: transform 0.15s ease-out;
}

/* Lora as Santiago's default body font, set on this game's own root and inherited by its
   subtree, rather than overriding Tailwind's shared --font-sans token, which would leak into
   the host page and harness chrome around it. */
/* Short screens, such as a phone held sideways: the board keeps a usable height, and the game
   column scrolls to reach it rather than squeezing it to nothing. */
@media (max-height: 500px) {
    .board-area {
        min-height: 260px;
    }
}

/* Phones: everything above the board, text and controls alike, at a smaller scale. */
@media (max-width: 639px), (max-height: 500px) {
    .above-board {
        --above-board-zoom: 0.85;
        zoom: var(--above-board-zoom);
    }
}

.santiago-root {
    font-family: 'Lora', ui-serif, Georgia, serif;
}
</style>

{#snippet drawPile()}
    <img src={desertUrl} alt="tiles remaining"
         class="w-full h-full object-cover"
         style="filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
    <span class="absolute inset-0 flex items-center justify-center text-white font-black text-[36px]"
          style="text-shadow: 0 1px 3px rgba(0,0,0,0.9)">
        {state.getRemainingTileCount()}
    </span>
{/snippet}

<CustomFont fontFamily="Bitter" url={BitterFont} format="woff2" />
<CustomFont fontFamily="Lora" url={LoraFont} format="woff2" />

<div class="santiago-root earth-texture bg-[#1c1410]" {@attach attachAnimator(deal)}>
    {#if session.isDeveloperHarness}
        <MoodTuner />
    {/if}
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
                        <div class="border-b border-stone-700/60 p-2">
                            <ActionPanel />
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
            <div class="above-board shrink-0" bind:this={topBarEl}>
                <ActionToolbar />
                <LastActionBanner boardCenterX={boardCenter.value} />
                <PlayerActionBar boardCenterX={boardCenter.value} />
            </div>
            <!-- Bottom part fills the remaining space, but hides overflow to keep its height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size -->
            <div class="board-area grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="left" controls="bottom-right">
                    <div class="w-fit">
                        <!-- ScalingWrapper (a shared library component) clips to its own
                             measured content box — CSS overflow:visible on anything inside
                             Board isn't enough, since that box is sized to the board's tight
                             bounds. This padding reserves genuine layout space around the
                             board so labels that poke out past its edges still fall inside
                             the box ScalingWrapper actually measures and doesn't clip. -->
                        <div class="pl-8 pr-8 pt-4">
                            <div class="flex items-start gap-4">
                                <!-- This round's tiles with the draw pile below them — a
                                     vertical strip to the board's left, top-aligned with it,
                                     in every phase so the board never shifts sideways. Before
                                     the reveal and after planting the pile stands alone at the
                                     top; once the bag is empty an outline keeps its place.
                                     mt-5 gives the top element's hover scale-up clearance
                                     against ScalingWrapper's measured content box; Board is
                                     taller than this column, so it borrows from
                                     already-reserved height. -->
                                <div class="flex flex-col gap-2 shrink-0 mt-5" style="perspective: 900px">
                                    {#each displayTiles as { tile, isSelected }, i (i)}
                                        <div
                                            class="shrink-0"
                                            style="transform-style: preserve-3d"
                                        >
                                            {#if preview.dealing}
                                                <!-- Two faces for the deal: the pile's back design
                                                     and the tile's face, which the animator turns
                                                     over once the pile has come to rest on it. The
                                                     deal's styles live on this card, so they go
                                                     with it when the deal ends. -->
                                                <div class="relative" style="width:{CELL_W}px; height:{CELL_H}px; transform-style: preserve-3d"
                                                     {@attach (el: HTMLElement) => {
                                                         deal.setTileNode(i, el)
                                                         return () => deal.setTileNode(i, undefined)
                                                     }}>
                                                    <img src={desertUrl} alt=""
                                                         class="absolute inset-0 w-full h-full rounded-md object-cover"
                                                         style="backface-visibility: hidden" />
                                                    <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                                         alt={tile.crop}
                                                         class="absolute inset-0 w-full h-full rounded-md object-cover"
                                                         style="backface-visibility: hidden; transform: rotateY(180deg); filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
                                                </div>
                                            {:else if isSelected}
                                                <div class="rounded-md overflow-hidden tile-selected shrink-0"
                                                     style="width:{CELL_W}px; height:{CELL_H}px">
                                                    <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                                         alt={tile.crop}
                                                         class="w-full h-full object-cover" />
                                                </div>
                                            {:else if isMyPlantTurn}
                                                <button
                                                    onclick={() => session.selectTile(i)}
                                                    class="rounded-md overflow-hidden transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                    style="width:{CELL_W}px; height:{CELL_H}px"
                                                >
                                                    <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                                         alt={tile.crop}
                                                         class="w-full h-full object-cover"
                                                         style="filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
                                                </button>
                                            {:else if isNeutralPlacementMode}
                                                <button
                                                    onclick={() => session.selectTile(i)}
                                                    class="relative rounded-md overflow-hidden ring-2 ring-purple-400/70 shrink-0 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                    style="width:{CELL_W}px; height:{CELL_H}px"
                                                >
                                                    <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                                         alt={tile.crop}
                                                         class="w-full h-full object-cover"
                                                         style="filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5)) grayscale(30%)" />
                                                </button>
                                            {:else}
                                                <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                                                     alt={tile.crop}
                                                     class="rounded-md object-cover"
                                                     style="width:{CELL_W}px; height:{CELL_H}px; filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
                                            {/if}
                                        </div>
                                    {/each}
                                    {#if state.getRemainingTileCount() > 0}
                                        <div
                                            class="relative z-10 shrink-0"
                                            {@attach (el) => {
                                                deal.setDrawPile(el)
                                                return () => deal.setDrawPile(undefined)
                                            }}
                                        >
                                            {#if session.canRevealTiles}
                                                <button
                                                    onclick={() => session.revealTiles()}
                                                    aria-label="Reveal this round's fields"
                                                    class="relative rounded-md overflow-hidden transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                    style="width:{CELL_W}px; height:{CELL_H}px"
                                                >
                                                    {@render drawPile()}
                                                </button>
                                            {:else}
                                                <div class="relative rounded-md overflow-hidden" style="width:{CELL_W}px; height:{CELL_H}px">
                                                    {@render drawPile()}
                                                </div>
                                            {/if}
                                        </div>
                                    {:else}
                                        <div class="rounded-md border-2 border-dashed border-amber-900/50"
                                             style="width:{CELL_W}px; height:{CELL_H}px"></div>
                                    {/if}
                                </div>
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
