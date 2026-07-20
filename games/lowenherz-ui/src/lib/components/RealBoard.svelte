<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HydratedPlaceCastle, squareKey, SquareType } from '@tabletop/lowenherz'

    const gameSession = getGameSession()
    const board = $derived(gameSession.gameState.board)
    const regions = $derived(gameSession.gameState.regions)

    // Expensive (re-scans the whole board with a validity check per candidate edge).
    // Must be computed ONCE per render via $derived, not re-invoked from inside a
    // per-square/per-edge check function - otherwise a 150-square grid would call it
    // 150 times each render (O(n^2), which got dramatically worse as more regions
    // accumulated from wall placement, since region-membership checks scale with
    // region count - that's what froze the page after "placing a bunch of walls").
    const legalCastleSquareSet = $derived(
        new Set(gameSession.legalCastleSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalWallEdges = $derived(gameSession.legalWallEdges)
    const legalKnightSquareSet = $derived(
        new Set(gameSession.legalKnightSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalExpansionSquareSet = $derived(
        new Set(gameSession.legalNextExpansionSquares.map((s) => `${s.col},${s.row}`))
    )

    // Whether the player is currently trying to expand a region rather than place a
    // knight - both are possible whenever canExpandRegion is true, so this is a plain
    // UI toggle, not game state.
    let expandMode = $state(false)

    // Reset expand-mode and any in-progress region selection every time a new
    // knight-placement turn begins (knightPlacingPlayerId goes through undefined
    // between turns, so this fires on every transition, including the same player
    // getting a later turn). Without this, a previous player's expandMode/selected
    // region carried over into the next player's turn - canExpandRegion would
    // correctly show the button, but legalNextExpansionSquares silently computed
    // legality against the wrong (stale) region id and came back empty, making it
    // look like there was nothing to click.
    let lastKnightPlacingPlayerId: string | undefined = $state(undefined)
    $effect(() => {
        const current = gameSession.gameState.knightPlacingPlayerId
        if (current !== lastKnightPlacingPlayerId) {
            lastKnightPlacingPlayerId = current
            expandMode = false
            gameSession.cancelExpansion()
        }
    })

    const CELL_SIZE = 44

    // Placeholder visuals per the plan - real art comes later.
    const terrainBg: Record<SquareType, string> = {
        [SquareType.Blank]: '#e7dfc9',
        [SquareType.Forest]: '#4c7a3d',
        [SquareType.Hill]: '#9a6b3a',
        [SquareType.Village]: '#a63b3b'
    }

    function isSelected(col: number, row: number): boolean {
        const sel = gameSession.selectedCastleSquare
        return sel !== undefined && sel.col === col && sel.row === row
    }

    // Only the knight squares that would actually be legal for the selected castle -
    // not just any adjacent square - so the highlight matches what's clickable.
    function isLegalKnightSquare(col: number, row: number): boolean {
        const sel = gameSession.selectedCastleSquare
        if (!sel) return false
        return HydratedPlaceCastle.isValidKnightSquare(gameSession.gameState, sel.col, sel.row, col, row)
    }

    function isLegalCastleSquare(col: number, row: number): boolean {
        return legalCastleSquareSet.has(`${col},${row}`)
    }

    // Regular-play knight placement (distinct from isLegalKnightSquare, which is for
    // the setup-phase castle+knight two-click flow).
    function isLegalKnightPlacement(col: number, row: number): boolean {
        return legalKnightSquareSet.has(`${col},${row}`)
    }

    function isLegalExpansionSquare(col: number, row: number): boolean {
        return legalExpansionSquareSet.has(`${col},${row}`)
    }

    function isOwnSelectableRegion(col: number, row: number): boolean {
        if (gameSession.selectedExpandRegionId) return false
        const key = squareKey(col, row)
        return gameSession.myRegions.some((r) => r.squareKeys.includes(key))
    }

    // A faint tint over any square already claimed by a region, so newly-created
    // regions are visible at a glance. Neutral zones (no owner) get a plain gray tint.
    function regionTint(col: number, row: number): string | undefined {
        const key = squareKey(col, row)
        const region = regions.find((r) => r.squareKeys.includes(key))
        if (!region) return undefined
        return region.ownerColor ? gameSession.colors.getUiColor(region.ownerColor) : '#888888'
    }

    async function onSquareClick(col: number, row: number) {
        if (gameSession.selectedCastleSquare) {
            if (isSelected(col, row)) {
                gameSession.clearCastleSelection()
                return
            }
            await gameSession.placeCastleWithKnight(col, row)
            return
        }

        if (gameSession.canPlaceCastle) {
            gameSession.selectCastleSquare(col, row)
            return
        }

        if (expandMode && gameSession.canExpandRegion) {
            if (!gameSession.selectedExpandRegionId) {
                if (isOwnSelectableRegion(col, row)) {
                    const key = squareKey(col, row)
                    const region = gameSession.myRegions.find((r) => r.squareKeys.includes(key))
                    if (region) gameSession.selectRegionToExpand(region.id)
                }
                return
            }
            if (isLegalExpansionSquare(col, row)) {
                gameSession.addExpansionSquare(col, row)
            }
            return
        }

        if (gameSession.canPlaceKnight) {
            await gameSession.placeKnight(col, row)
        }
    }
</script>

<div class="flex flex-col gap-2">
    <div class="text-black text-sm">
        {#if gameSession.canPlaceCastle}
            {#if gameSession.selectedCastleSquare}
                Castle location picked — click an adjacent blank square to place your knight (or
                click the castle square again to cancel).
            {:else}
                Your turn — click a blank square to place your next castle.
            {/if}
        {:else if gameSession.canPlaceWall}
            You won a border action — click one of the highlighted lines on the board to
            place a wall there ({gameSession.gameState.wallsRemaining} left), or pass if
            you don't want to place any (more).
        {:else if gameSession.canPlaceKnight && expandMode}
            {#if !gameSession.selectedExpandRegionId}
                Click one of your regions (highlighted) to expand it.
            {:else}
                Click a highlighted square to add it to the expansion ({gameSession.expansionSquares
                    .length}/2 picked so far).
            {/if}
        {:else if gameSession.canPlaceKnight}
            You won a knight action — click one of the highlighted squares to place a
            knight there ({gameSession.gameState.knightsRemaining} left).
            {#if gameSession.myRegions.length === 0}
                (No "expand region" option yet — that needs a completed region from a
                wall placement first.)
            {/if}
        {:else if !gameSession.setupComplete}
            Waiting for the other player(s) to place a castle...
        {:else}
            Waiting for the next action to resolve...
        {/if}
    </div>

    {#if gameSession.canExpandRegion}
        <div class="flex gap-2 items-center">
            <button
                type="button"
                class="px-2 py-1 rounded text-sm {!expandMode
                    ? 'bg-black text-white'
                    : 'bg-black/10 text-black hover:bg-black/20'}"
                onclick={() => {
                    expandMode = false
                    gameSession.cancelExpansion()
                }}
            >
                Place knight
            </button>
            <button
                type="button"
                class="px-2 py-1 rounded text-sm {expandMode
                    ? 'bg-black text-white'
                    : 'bg-black/10 text-black hover:bg-black/20'}"
                onclick={() => {
                    expandMode = true
                    if (gameSession.myRegions.length === 1) {
                        gameSession.selectRegionToExpand(gameSession.myRegions[0].id)
                    }
                }}
            >
                Expand region
            </button>
            {#if expandMode && gameSession.expansionSquares.length > 0}
                <button
                    type="button"
                    class="px-2 py-1 rounded bg-green-700 text-white text-sm hover:bg-green-800"
                    onclick={() => gameSession.confirmExpansion()}
                >
                    Confirm expansion
                </button>
                <button
                    type="button"
                    class="px-2 py-1 rounded bg-black/10 text-black text-sm hover:bg-black/20"
                    onclick={() => gameSession.cancelExpansion()}
                >
                    Cancel
                </button>
            {/if}
            <button
                type="button"
                class="px-2 py-1 rounded bg-black/10 text-black text-sm hover:bg-black/20"
                onclick={() => gameSession.passKnightPlacement()}
            >
                Pass
            </button>
        </div>
    {:else if gameSession.canPlaceKnight}
        <div>
            <button
                type="button"
                class="px-2 py-1 rounded bg-black/10 text-black text-sm hover:bg-black/20"
                onclick={() => gameSession.passKnightPlacement()}
            >
                Pass
            </button>
        </div>
    {/if}

    {#if gameSession.canPlaceWall}
        <div>
            <button
                type="button"
                class="px-2 py-1 rounded bg-black/10 text-black text-sm hover:bg-black/20"
                onclick={() => gameSession.passWallPlacement()}
            >
                Pass
            </button>
        </div>
    {/if}

    {#if !gameSession.setupComplete}
        <div>
            <button
                type="button"
                class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
                onclick={() => gameSession.autoPlaceAllCastles()}
            >
                Auto-place all castles (testing)
            </button>
        </div>
    {:else}
        <div>
            <button
                type="button"
                class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
                onclick={() => gameSession.seedTestRegions()}
            >
                Seed a region per color (testing)
            </button>
        </div>
    {/if}

    {#if gameSession.errorMessage}
        <div class="text-red-700 text-sm font-medium">
            {gameSession.errorMessage}
        </div>
    {/if}

    <div class="relative" style="width: fit-content;">
        <div
            class="grid border-2 border-black/60"
            style="grid-template-columns: repeat({board.squares[0].length}, {CELL_SIZE}px);"
        >
            {#each board.squares as rowSquares, row (row)}
                {#each rowSquares as square, col (col)}
                    {@const tint = regionTint(col, row)}
                    {@const expansionPick = expandMode && gameSession.expansionSquares.some((s) => s.col === col && s.row === row)}
                    <button
                        type="button"
                        onclick={() => onSquareClick(col, row)}
                        class="relative flex items-center justify-center border border-black/20 {isSelected(col, row) ? 'ring-4 ring-yellow-300 z-10' : ''} {isLegalKnightSquare(col, row) ? 'ring-2 ring-yellow-100' : ''} {!gameSession.selectedCastleSquare && isLegalCastleSquare(col, row) ? 'ring-2 ring-inset ring-emerald-500' : ''} {!expandMode && isLegalKnightPlacement(col, row) ? 'ring-2 ring-inset ring-orange-500' : ''} {expandMode && isOwnSelectableRegion(col, row) ? 'ring-2 ring-inset ring-purple-500' : ''} {expandMode && isLegalExpansionSquare(col, row) ? 'ring-4 ring-inset ring-purple-400' : ''} {expansionPick ? 'ring-4 ring-purple-700 z-10' : ''}"
                        style="width:{CELL_SIZE}px; height:{CELL_SIZE}px; background-color:{terrainBg[square.type]};"
                    >
                        {#if tint}
                            <span class="absolute inset-0 pointer-events-none" style="background-color:{tint}; opacity:0.35;"
                            ></span>
                        {/if}
                        {#if square.castleColor}
                            <span
                                class="absolute inset-0.5 rounded-full flex items-center justify-center text-lg {gameSession.colors.getBgColor(square.castleColor)}"
                            >
                                🏰
                            </span>
                        {:else if square.knightColor}
                            <span
                                class="absolute inset-0.5 rounded-full flex items-center justify-center text-lg {gameSession.colors.getBgColor(square.knightColor)}"
                            >
                                ⚔️
                            </span>
                        {/if}
                    </button>
                {/each}
            {/each}
        </div>

        <!-- Boundary walls: black bars on the relevant edge. -->

        {#each board.walls as wall (wall.col + ',' + wall.row + ',' + wall.edge)}
            <div
                class="absolute bg-black pointer-events-none"
                style="
                    left: {wall.edge === 'west' ? wall.col * CELL_SIZE - 2 : wall.col * CELL_SIZE}px;
                    top: {wall.edge === 'north' ? wall.row * CELL_SIZE - 2 : wall.row * CELL_SIZE}px;
                    width: {wall.edge === 'west' ? 4 : CELL_SIZE}px;
                    height: {wall.edge === 'north' ? 4 : CELL_SIZE}px;
                "
            ></div>
        {/each}

        <!-- Clickable lines for legal wall placements - one click directly on the
             boundary between two squares places the wall there. -->
        {#each legalWallEdges as edge (edge.col1 + ',' + edge.row1 + '-' + edge.col2 + ',' + edge.row2)}
            {@const sameRow = edge.row1 === edge.row2}
            <button
                type="button"
                aria-label="Place wall"
                class="absolute z-30 bg-blue-500/50 hover:bg-blue-500/80 cursor-pointer"
                style="
                    left: {sameRow ? edge.col2 * CELL_SIZE - 8 : edge.col1 * CELL_SIZE}px;
                    top: {sameRow ? edge.row1 * CELL_SIZE : edge.row2 * CELL_SIZE - 8}px;
                    width: {sameRow ? 16 : CELL_SIZE}px;
                    height: {sameRow ? CELL_SIZE : 16}px;
                "
                onclick={() => gameSession.placeWallBetween(edge.col1, edge.row1, edge.col2, edge.row2)}
            ></button>
        {/each}
    </div>
</div>
