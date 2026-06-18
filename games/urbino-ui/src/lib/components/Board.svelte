<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import Square from './Square.svelte'
    import { BOARD_SIZE, BOARD_SQUARES, getDistrictFrom, posToRowCol, rowColToPos } from '@tabletop/urbino'
    import { markBoardReady } from '$lib/animators/buildingPlacementAnimator.js'
    import { onMount } from 'svelte'

    const session = getGameSession()

    onMount(() => {
        requestAnimationFrame(() => markBoardReady())
    })
    const state = $derived(session.gameState)

    const squares = Array.from({ length: BOARD_SQUARES }, (_, i) => i)

    const validSquares = $derived.by(() => {
        if (session.selectedArchitectIndex !== undefined) {
            return new Set(session.validRepositionSquares)
        }
        if (session.canPlaceArchitect) {
            return new Set(session.validArchitectPlacementSquares)
        }
        if (session.selectedBuildingType) {
            return new Set(session.validPlacementSquares)
        }
        return new Set<number>()
    })

    let hoveredPos = $state<number | null>(null)

    const hoveredDistrict = $derived.by(() => {
        if (hoveredPos === null || state.board[hoveredPos] === null) return new Set<number>()
        return getDistrictFrom(state.board, hoveredPos)
    })

    type EdgeFlags = { top: boolean; right: boolean; bottom: boolean; left: boolean }

    const districtEdgeMap = $derived.by(() => {
        const map = new Map<number, EdgeFlags>()
        for (const pos of hoveredDistrict) {
            const [row, col] = posToRowCol(pos)
            map.set(pos, {
                top: row === 0 || !hoveredDistrict.has(rowColToPos(row - 1, col)),
                bottom: row === BOARD_SIZE - 1 || !hoveredDistrict.has(rowColToPos(row + 1, col)),
                left: col === 0 || !hoveredDistrict.has(rowColToPos(row, col - 1)),
                right: col === BOARD_SIZE - 1 || !hoveredDistrict.has(rowColToPos(row, col + 1)),
            })
        }
        return map
    })

    function handleSquareClick(pos: number, e: MouseEvent) {
        const square = state.board[pos]
        const architectAt = state.architects.indexOf(pos)

        // Architect placement (setup phase)
        if (session.canPlaceArchitect && square === null && pos !== state.architects[0] && pos !== state.architects[1]) {
            session.placeArchitect(pos)
            return
        }

        // Click on architect to select/switch selection for repositioning
        if (session.canRepositionArchitect && architectAt >= 0) {
            session.selectArchitect(architectAt)
            return
        }

        // Reposition to clicked square
        if (session.selectedArchitectIndex !== undefined && validSquares.has(pos)) {
            session.repositionArchitect(session.selectedArchitectIndex, pos)
            return
        }

        // Place building
        if (session.selectedBuildingType && validSquares.has(pos)) {
            session.placeBuilding(pos, session.selectedBuildingType)
            return
        }
    }
</script>

<div
    class="inline-grid border-[10px] border-[#b3b3b3] bg-[#b3b3b3]"
    style="grid-template-columns: repeat({BOARD_SIZE}, 1fr); gap: 2px;"
>
    {#each squares as pos}
        {@const building = state.board[pos]}
        {@const architectIndex = state.architects.indexOf(pos)}
        {@const isValid = validSquares.has(pos)}
        {@const uiColor = building ? session.colors.getPlayerUiColor(building.playerId) : undefined}
        <Square
            {pos}
            {building}
            {architectIndex}
            {isValid}
            selectedArchitectIndex={session.selectedArchitectIndex}
            playerColor={uiColor}
            districtEdges={districtEdgeMap.get(pos)}
            onHover={(p) => (hoveredPos = p)}
            onHoverEnd={() => (hoveredPos = null)}
            onclick={(e) => handleSquareClick(pos, e)}
        />
    {/each}
</div>
