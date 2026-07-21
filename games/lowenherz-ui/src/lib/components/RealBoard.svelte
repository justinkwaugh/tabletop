<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Color } from '@tabletop/common'
    import { HydratedPlaceCastle, isExpandRegion, isPlaceWall, squareKey, SquareType } from '@tabletop/lowenherz'

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
    const legalRenegadeEnemyRegionIds = $derived(new Set(gameSession.legalRenegadeEnemyRegions.map((r) => r.id)))
    const legalRenegadeRemovableSquareSet = $derived(
        new Set(gameSession.legalRenegadeRemovableSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalRenegadePlacementSquareSet = $derived(
        new Set(gameSession.legalRenegadePlacementSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalAllianceEnemyRegionIds = $derived(new Set(gameSession.legalAllianceEnemyRegions.map((r) => r.id)))

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

    // Floating "+N"/"-N" popups near wherever a region was just created, expanded,
    // invaded, or shrunk - one per scoring event, in the affected player's color,
    // auto-removed after a couple seconds. Watches gameSession.actions (append-only
    // while actively playing) for newly-arrived PlaceWall/ExpandRegion actions and
    // reads their metadata for exact anchor squares/amounts - see the anchorSquareKey
    // fields on PlaceWallMetadata/ExpandRegionMetadata.
    type ScorePopup = { id: string; col: number; row: number; text: string; color: string }
    let popups: ScorePopup[] = $state([])
    const POPUP_LIFETIME_MS = 2000

    function addPopup(anchorKey: string, amount: number, color: string) {
        if (amount === 0) return
        const [col, row] = anchorKey.split(',').map(Number)
        const id = `${Date.now()}-${Math.random()}`
        popups = [...popups, { id, col, row, text: amount > 0 ? `+${amount}` : `${amount}`, color }]
        setTimeout(() => {
            popups = popups.filter((p) => p.id !== id)
        }, POPUP_LIFETIME_MS)
    }

    function popupsForCompletedRegions(
        regions: { ownerColor?: Color; points: number; anchorSquareKey: string }[] | undefined
    ) {
        for (const region of regions ?? []) {
            const color = region.ownerColor ? gameSession.colors.getUiColor(region.ownerColor) : '#888888'
            addPopup(region.anchorSquareKey, region.points, color)
        }
    }

    // processedActionCount starts uninitialized (-1) so the first effect run just
    // records the current history length instead of firing a popup for every past
    // action already in the game when this component mounts.
    let processedActionCount = -1
    $effect(() => {
        const actions = gameSession.actions
        if (processedActionCount === -1) {
            processedActionCount = actions.length
            return
        }
        const newActions = actions.slice(processedActionCount)
        processedActionCount = actions.length

        for (const action of newActions) {
            if (isPlaceWall(action)) {
                popupsForCompletedRegions(action.metadata?.completedRegions)
            } else if (isExpandRegion(action)) {
                if (action.metadata?.pointsGained && action.spaces[0]) {
                    const color = gameSession.colors.getUiColor(
                        gameSession.gameState.getPlayerState(action.playerId).color
                    )
                    addPopup(squareKey(action.spaces[0].col, action.spaces[0].row), action.metadata.pointsGained, color)
                }
                for (const invasion of action.metadata?.invasions ?? []) {
                    const victimColor = gameSession.colors.getUiColor(invasion.victimColor)
                    addPopup(invasion.directAnchorSquareKey, -invasion.directPointsLost, victimColor)
                    if (invasion.disconnectedAnchorSquareKey) {
                        addPopup(invasion.disconnectedAnchorSquareKey, -invasion.disconnectedPointsLost, victimColor)
                    }
                }
                popupsForCompletedRegions(action.metadata?.completedRegions)
            }
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

    function regionAt(col: number, row: number) {
        const key = squareKey(col, row)
        return regions.find((r) => r.squareKeys.includes(key))
    }

    function isOwnSelectableRenegadeRegion(col: number, row: number): boolean {
        if (gameSession.renegadeOwnRegionId) return false
        return isOwnSelectableRegion(col, row)
    }

    function isSelectableRenegadeEnemyRegion(col: number, row: number): boolean {
        if (!gameSession.renegadeOwnRegionId || gameSession.renegadeEnemyRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && legalRenegadeEnemyRegionIds.has(region.id)
    }

    function isLegalRenegadeRemovableSquare(col: number, row: number): boolean {
        return !gameSession.renegadeRemovedSquare && legalRenegadeRemovableSquareSet.has(`${col},${row}`)
    }

    function isRenegadeRemovedSquare(col: number, row: number): boolean {
        const sel = gameSession.renegadeRemovedSquare
        return sel !== undefined && sel.col === col && sel.row === row
    }

    function isLegalRenegadePlacementSquare(col: number, row: number): boolean {
        return legalRenegadePlacementSquareSet.has(`${col},${row}`)
    }

    function isOwnSelectableAllianceRegion(col: number, row: number): boolean {
        if (gameSession.allianceOwnRegionId) return false
        return isOwnSelectableRegion(col, row)
    }

    function isSelectableAllianceEnemyRegion(col: number, row: number): boolean {
        if (!gameSession.allianceOwnRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && legalAllianceEnemyRegionIds.has(region.id)
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
        if (gameSession.isPlayingAllianceCard) {
            if (!gameSession.allianceOwnRegionId) {
                if (isOwnSelectableAllianceRegion(col, row)) {
                    const region = regionAt(col, row)
                    if (region) gameSession.selectAllianceOwnRegion(region.id)
                }
                return
            }
            if (isSelectableAllianceEnemyRegion(col, row)) {
                const region = regionAt(col, row)
                if (region) await gameSession.selectAllianceEnemyRegion(region.id)
            }
            return
        }

        if (gameSession.isPlayingRenegadeCard) {
            if (!gameSession.renegadeOwnRegionId) {
                if (isOwnSelectableRenegadeRegion(col, row)) {
                    const region = regionAt(col, row)
                    if (region) gameSession.selectRenegadeOwnRegion(region.id)
                }
                return
            }
            if (!gameSession.renegadeEnemyRegionId) {
                if (isSelectableRenegadeEnemyRegion(col, row)) {
                    const region = regionAt(col, row)
                    if (region) gameSession.selectRenegadeEnemyRegion(region.id)
                }
                return
            }
            if (!gameSession.renegadeRemovedSquare) {
                if (isLegalRenegadeRemovableSquare(col, row)) {
                    gameSession.selectRenegadeRemovedSquare(col, row)
                }
                return
            }
            if (isLegalRenegadePlacementSquare(col, row)) {
                await gameSession.confirmRenegadePlacement(col, row)
            }
            return
        }

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
        {#if gameSession.isPlayingAllianceCard}
            {#if !gameSession.allianceOwnRegionId}
                Playing Alliance — click one of your regions (highlighted).
            {:else if legalAllianceEnemyRegionIds.size === 0}
                That region has no neighboring enemy region left to ally with. Click Cancel
                to try a different region.
            {:else}
                Now click a bordering enemy region (highlighted) to ally with it — neither
                region will be expandable into the other until the alliance ends.
            {/if}
        {:else if gameSession.isPlayingRenegadeCard}
            {#if !gameSession.renegadeOwnRegionId}
                Playing Renegade — click one of your regions (highlighted).
            {:else if !gameSession.renegadeEnemyRegionId}
                {#if legalRenegadeEnemyRegionIds.size === 0}
                    That region has no neighboring enemy region to target. Click Cancel to
                    try a different region.
                {:else}
                    Now click a bordering enemy region (highlighted).
                {/if}
            {:else if !gameSession.renegadeRemovedSquare}
                {#if gameSession.legalRenegadeRemovableSquares.length === 0}
                    Every knight in that region is protecting another from being cut off from
                    its castle — none can safely be removed. Click Cancel to try again.
                {:else}
                    Click the enemy knight (highlighted) to remove.
                {/if}
            {:else}
                Now click a square in your region to place your knight in exchange.
            {/if}
        {:else if gameSession.canPlaceCastle}
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
            {:else if gameSession.expansionSquares.length === 0 && gameSession.legalNextExpansionSquares.length === 0}
                This region has nowhere legal to expand into right now.
                {#if gameSession.myRegions.length > 1}
                    Click Cancel to try a different region, or place a knight / pass instead.
                {:else}
                    Click Cancel, then place a knight or pass instead.
                {/if}
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

    {#if gameSession.canPlaceKnight && gameSession.myTreasureCards.length > 0}
        <div class="flex items-center gap-2 text-black text-sm">
            <span>Pay a wooded space's cost with:</span>
            <select
                value={gameSession.selectedTreasureCardId ?? ''}
                onchange={(e) => gameSession.selectTreasureCard(e.currentTarget.value || undefined)}
                class="rounded border border-black/30 px-1 py-0.5"
            >
                <option value="">ducats (default)</option>
                {#each gameSession.myTreasureCards as treasureCard (treasureCard.id)}
                    <option value={treasureCard.id}>Treasure ({treasureCard.value})</option>
                {/each}
            </select>
        </div>
    {/if}

    {#if gameSession.isPlayingRenegadeCard}
        <div>
            <button
                type="button"
                class="px-2 py-1 rounded bg-black/10 text-black text-sm hover:bg-black/20"
                onclick={() => gameSession.cancelPlayingRenegadeCard()}
            >
                Cancel
            </button>
        </div>
    {/if}

    {#if gameSession.isPlayingAllianceCard}
        <div>
            <button
                type="button"
                class="px-2 py-1 rounded bg-black/10 text-black text-sm hover:bg-black/20"
                onclick={() => gameSession.cancelPlayingAllianceCard()}
            >
                Cancel
            </button>
        </div>
    {/if}

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
            {#if expandMode && gameSession.selectedExpandRegionId}
                {#if gameSession.expansionSquares.length > 0}
                    <button
                        type="button"
                        class="px-2 py-1 rounded bg-green-700 text-white text-sm hover:bg-green-800"
                        onclick={() => gameSession.confirmExpansion()}
                    >
                        Confirm expansion
                    </button>
                {/if}
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
                Seed regions for unclaimed castles (testing)
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
                        class="relative flex items-center justify-center border border-black/20 {isSelected(col, row) ? 'ring-4 ring-yellow-300 z-10' : ''} {isLegalKnightSquare(col, row) ? 'ring-2 ring-yellow-100' : ''} {!gameSession.selectedCastleSquare && isLegalCastleSquare(col, row) ? 'ring-2 ring-inset ring-emerald-500' : ''} {!expandMode && isLegalKnightPlacement(col, row) ? 'ring-2 ring-inset ring-orange-500' : ''} {expandMode && isOwnSelectableRegion(col, row) ? 'ring-2 ring-inset ring-purple-500' : ''} {expandMode && isLegalExpansionSquare(col, row) ? 'ring-4 ring-inset ring-purple-400' : ''} {expansionPick ? 'ring-4 ring-purple-700 z-10' : ''} {isOwnSelectableRenegadeRegion(col, row) ? 'ring-2 ring-inset ring-rose-500' : ''} {isSelectableRenegadeEnemyRegion(col, row) ? 'ring-2 ring-inset ring-red-600' : ''} {isLegalRenegadeRemovableSquare(col, row) ? 'ring-4 ring-inset ring-red-500' : ''} {isRenegadeRemovedSquare(col, row) ? 'ring-4 ring-red-800 z-10' : ''} {isLegalRenegadePlacementSquare(col, row) ? 'ring-4 ring-inset ring-sky-400' : ''} {isOwnSelectableAllianceRegion(col, row) ? 'ring-2 ring-inset ring-teal-500' : ''} {isSelectableAllianceEnemyRegion(col, row) ? 'ring-4 ring-inset ring-indigo-500' : ''}"
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

        <!-- Floating score-change popups (see the $effect above) -->
        {#each popups as popup (popup.id)}
            <div
                class="score-popup absolute z-50 pointer-events-none rounded-full px-2 py-0.5 text-sm font-bold text-white shadow"
                style="left:{popup.col * CELL_SIZE + CELL_SIZE / 2}px; top:{popup.row *
                    CELL_SIZE}px; background-color:{popup.color};"
            >
                {popup.text}
            </div>
        {/each}
    </div>
</div>

<style>
    @keyframes score-popup-float {
        0% {
            transform: translate(-50%, -50%) translateY(0);
            opacity: 1;
        }
        100% {
            transform: translate(-50%, -50%) translateY(-32px);
            opacity: 0;
        }
    }

    .score-popup {
        animation: score-popup-float 2s ease-out forwards;
    }
</style>
