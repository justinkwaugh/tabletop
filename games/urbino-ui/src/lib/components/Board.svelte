<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import BoardSurface from './BoardSurface.svelte'
    import Building from './Building.svelte'
    import Architect from './Architect.svelte'
    import Square from './Square.svelte'
    import { BOARD_SQUARES, getDistrictFrom } from '@tabletop/urbino'
    import {
        BOARD_DISPLAY_SCALE,
        BOARD_PIXELS,
        BUILDING_FOOTPRINT,
        BUILDING_HEIGHT,
        SQUARE_SIZE,
        shadowOffset,
        squareCenter,
        squareOrigin
    } from '$lib/board/geometry.js'
    import { architectSightlines } from '$lib/board/sightlines.js'
    import { districtOutline } from '$lib/board/districtOutline.js'
    import { BuildingDropAnimator } from '$lib/animators/buildingDropAnimator.svelte.js'
    import BuildingShape from './BuildingShape.svelte'
    import { ArchitectMoveAnimator } from '$lib/animators/architectMoveAnimator.svelte.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'

    const session = getGameSession()

    const gameState = $derived(session.gameState)
    const architectMoveAnimator = new ArchitectMoveAnimator(session)
    const buildingDropAnimator = new BuildingDropAnimator(session)

    const squares = Array.from({ length: BOARD_SQUARES }, (_, i) => i)
    const SHADOW_ROOM = 16
    const validInset = 6
    const validRingRadius = 0.13 * SQUARE_SIZE
    const previewInset = (SQUARE_SIZE - BUILDING_FOOTPRINT) / 2

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

    const repositionPreview = $derived(hoveredPos === null ? undefined : session.repositionPreview(hoveredPos))

    const sightlines = $derived.by(() => {
        if (!session.showsSightlines) return []
        return architectSightlines(gameState.board, repositionPreview?.architects ?? architectMoveAnimator.positions)
    })

    const hoveredDistrict = $derived(
        hoveredPos === null || gameState.board[hoveredPos] === null
            ? undefined
            : getDistrictFrom(gameState.board, hoveredPos)
    )
    const hoveredOutline = $derived(hoveredDistrict ? districtOutline(hoveredDistrict) : [])

    function isClickable(pos: number) {
        const architectIndex = gameState.architects.indexOf(pos)
        return (
            validSquares.has(pos) ||
            (session.canRepositionArchitect &&
                architectIndex >= 0 &&
                session.architectsWithValidMoves.has(architectIndex))
        )
    }

    function handleSquareClick(pos: number) {
        const square = gameState.board[pos]
        const architectAt = gameState.architects.indexOf(pos)

        if (session.canPlaceArchitect && square === null && pos !== gameState.architects[0] && pos !== gameState.architects[1]) {
            session.placeArchitect(pos)
            return
        }

        if (session.canRepositionArchitect && architectAt >= 0 && session.architectsWithValidMoves.has(architectAt)) {
            session.selectArchitect(architectAt)
            return
        }

        if (session.selectedArchitectIndex !== undefined && validSquares.has(pos)) {
            session.repositionArchitect(session.selectedArchitectIndex, pos)
            return
        }

        if (session.selectedBuildingType && validSquares.has(pos)) {
            session.placeBuilding(pos, session.selectedBuildingType)
            return
        }
    }
</script>

<svg
    viewBox="{-SHADOW_ROOM} {-SHADOW_ROOM} {BOARD_PIXELS + 2 * SHADOW_ROOM} {BOARD_PIXELS + 2 * SHADOW_ROOM}"
    width={(BOARD_PIXELS + 2 * SHADOW_ROOM) * BOARD_DISPLAY_SCALE}
    height={(BOARD_PIXELS + 2 * SHADOW_ROOM) * BOARD_DISPLAY_SCALE}
    class="select-none"
    role="img"
    aria-label="Urbino board"
>
    <BoardSurface />

    <g pointer-events="none">
        {#each session.selectedArchitectIndex === undefined ? [...validSquares] : [] as pos (pos)}
            {@const origin = squareOrigin(pos)}
            <rect
                x={origin.x + validInset}
                y={origin.y + validInset}
                width={SQUARE_SIZE - 2 * validInset}
                height={SQUARE_SIZE - 2 * validInset}
                rx="4"
                fill="#fff3c4"
                opacity="0.55"
            />
        {/each}

        {#each sightlines as line (`${line.from}-${line.to}`)}
            {@const from = squareCenter(line.from)}
            {@const to = squareCenter(line.to)}
            <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#b4301f"
                stroke-width="2"
                stroke-dasharray="1 6"
                stroke-linecap="round"
                opacity="0.6"
            />
        {/each}

        {#each repositionPreview ? [] : [...validSquares] as pos (pos)}
            {@const center = squareCenter(pos)}
            <circle
                cx={center.x}
                cy={center.y}
                r={validRingRadius}
                fill="none"
                stroke="#b8860b"
                stroke-width="2.5"
                opacity={session.selectedArchitectIndex === undefined ? 1 : 0.6}
            />
        {/each}

        {#if repositionPreview}
            {#each [...repositionPreview.placements] as pos (pos)}
                {@const origin = squareOrigin(pos)}
                <rect
                    x={origin.x + previewInset}
                    y={origin.y + previewInset}
                    width={SQUARE_SIZE - 2 * previewInset}
                    height={SQUARE_SIZE - 2 * previewInset}
                    rx="3"
                    fill="#f2c14e"
                    fill-opacity="0.28"
                    stroke="#a87808"
                    stroke-width="2"
                    stroke-dasharray="5 4"
                />
            {/each}
            <g opacity="0.55">
                <Architect center={squareCenter(repositionPreview.position)} selected={false} selectable={false} />
            </g>
        {/if}

        <g filter="url(#urbino-piece-grain)">
            {#each squares as pos (pos)}
                {@const building = gameState.board[pos]}
                {#if building}
                    <Building
                        buildingType={building.buildingType}
                        color={session.colors.getPlayerUiColor(building.playerId)}
                        buildingStyle={session.buildingStyle}
                        center={squareCenter(pos)}
                        dimmed={hoveredDistrict !== undefined && !hoveredDistrict.has(pos)}
                    />
                {/if}
            {/each}
            {#each buildingDropAnimator.landed as { position, building } (position)}
                {#if gameState.board[position] === null}
                    <Building
                        buildingType={building.buildingType}
                        color={session.colors.getPlayerUiColor(building.playerId)}
                        buildingStyle={session.buildingStyle}
                        center={squareCenter(position)}
                    />
                {/if}
            {/each}
            {#if buildingDropAnimator.incoming}
                {@const { position, building } = buildingDropAnimator.incoming}
                {@const center = squareCenter(position)}
                <g transform="translate({center.x} {center.y})">
                    <g {@attach buildingDropAnimator.landing()}>
                        <BuildingShape
                            buildingType={building.buildingType}
                            color={session.colors.getPlayerUiColor(building.playerId)}
                            buildingStyle={session.buildingStyle}
                            footprint={BUILDING_FOOTPRINT}
                            shadow={{ offset: shadowOffset(BUILDING_HEIGHT[building.buildingType]), blurred: true }}
                        />
                    </g>
                </g>
            {/if}
        </g>
        <g {@attach attachAnimator(buildingDropAnimator)}></g>

        <g filter="url(#urbino-piece-grain)" {@attach attachAnimator(architectMoveAnimator)}>
            {#each architectMoveAnimator.positions as pos, architectIndex (architectIndex)}
                {#if pos >= 0}
                    {@const center = squareCenter(pos)}
                    <g transform="translate({center.x} {center.y})">
                        <g {@attach architectMoveAnimator.pawn(architectIndex)}>
                            <Architect
                                center={{ x: 0, y: 0 }}
                                selected={architectIndex === session.selectedArchitectIndex}
                                selectable={session.canRepositionArchitect &&
                                    session.architectsWithValidMoves.has(architectIndex)}
                            />
                        </g>
                    </g>
                {/if}
            {/each}
        </g>

        {#each hoveredOutline as segment (`${segment.x1},${segment.y1},${segment.x2},${segment.y2}`)}
            <line {...segment} stroke="#e0a91a" stroke-width="3.5" stroke-linecap="round" filter="url(#urbino-glow)" />
        {/each}
    </g>

    {#each squares as pos (pos)}
        <Square
            {pos}
            hasBuilding={gameState.board[pos] !== null}
            hasArchitect={gameState.architects.includes(pos)}
            clickable={isClickable(pos)}
            onHover={(p) => (hoveredPos = p)}
            onHoverEnd={() => (hoveredPos = null)}
            onclick={() => handleSquareClick(pos)}
        />
    {/each}
</svg>
