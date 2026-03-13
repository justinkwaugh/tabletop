<script lang="ts">
    import {
        buildBusesTablePiecePlacements,
        BusPiecePlacementAnimator
    } from '$lib/animators/busPiecePlacementAnimator.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import {
        ScoreMarkerAnimator,
        animateScoreMarker,
        buildScoreMarkerPlacements,
        type ScoreMarkerPlacement
    } from '$lib/animators/scoreMarkerAnimator.js'
    import {
        BUS_BUILDING_PHASE_MARKER_POINT,
        BUS_BUILDING_SUPPLY_TEXT_POINT,
        BUS_PASSENGER_SUPPLY_TEXT_POINT
    } from '$lib/definitions/busBoardGraph.js'
    import BusPieceIcon from '$lib/images/BusPieceIcon.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const SCORE_MARKER_RADIUS = 17
    const SCORE_MARKER_STROKE = '#1f2a3d'
    const SCORE_MARKER_STROKE_WIDTH = 1.4
    const SCORE_MARKER_TEXT_SIZE = 13
    const SCORE_MARKER_TEXT_Y_OFFSET = 0.8
    const BUS_TABLE_PIECE_WIDTH = 58
    const BUS_TABLE_PIECE_HEIGHT = 31
    const BUS_TABLE_PIECE_SHADOW_OFFSET_Y = 8
    const BUS_TABLE_PIECE_SHADOW_RX = BUS_TABLE_PIECE_WIDTH * 0.36
    const BUS_TABLE_PIECE_SHADOW_RY = BUS_TABLE_PIECE_HEIGHT * 0.17
    const PASSENGER_SUPPLY_FONT_SIZE = 26
    const BUILDING_SUPPLY_FONT_SIZE = 26
    const BUILDING_PHASE_MARKER_RADIUS = 18
    const BUILDING_PHASE_MARKER_TEXT_SIZE = 28

    const BUILDING_PHASE_TEXT_COLOR_BY_PHASE: Record<number, string> = {
        1: '#6fb6ab',
        2: '#e38aa7',
        3: '#d3d8e6',
        4: '#f6e89a'
    }

    type ScoreMarker = ScoreMarkerPlacement & { textColor: string; fillColor: string }

    type AnimatedBusPiece = {
        key: string
        x: number
        y: number
        color: string
        scale: number
        opacity: number
    }

    let animatedAddedBusPieces: AnimatedBusPiece[] = $derived.by(() => {
        gameSession.gameState
        return []
    })

    let animatedRemovedBusPieces: AnimatedBusPiece[] = $derived.by(() => {
        gameSession.gameState
        return []
    })

    const scoreMarkerAnimator = new ScoreMarkerAnimator(gameSession)

    const busPiecePlacementAnimator = new BusPiecePlacementAnimator(gameSession, {
        onPlacementStart: ({ key, x, y, color, scale, opacity }) => {
            animatedAddedBusPieces = [
                ...animatedAddedBusPieces,
                { key, x, y, color, scale, opacity }
            ]
        },
        onPlacementUpdate: ({ key, scale, opacity }) => {
            animatedAddedBusPieces = animatedAddedBusPieces.map((piece) =>
                piece.key === key
                    ? {
                          ...piece,
                          scale,
                          opacity
                      }
                    : piece
            )
        },
        onRemovalStart: ({ key, x, y, color, scale, opacity }) => {
            animatedRemovedBusPieces = [
                ...animatedRemovedBusPieces,
                { key, x, y, color, scale, opacity }
            ]
        },
        onRemovalUpdate: ({ key, scale, opacity }) => {
            animatedRemovedBusPieces = animatedRemovedBusPieces.map((piece) =>
                piece.key === key
                    ? {
                          ...piece,
                          scale,
                          opacity
                      }
                    : piece
            )
        }
    })

    const scoreMarkers: ScoreMarker[] = $derived.by(() => {
        const state = gameSession.gameState
        return buildScoreMarkerPlacements(state).map((marker) => ({
            ...marker,
            textColor: playerTextColor(marker.playerId),
            fillColor: gameSession.colors.getPlayerUiColor(marker.playerId)
        }))
    })

    const busesTablePieces = $derived.by(() => {
        return buildBusesTablePiecePlacements(
            gameSession.gameState,
            (playerId) => gameSession.colors.getPlayerColor(playerId),
            (playerId) => gameSession.colors.getPlayerUiColor(playerId)
        )
    })

    const animatedAddedBusPieceKeys = $derived.by(() => {
        return new Set(animatedAddedBusPieces.map((piece) => piece.key))
    })

    const animatedRemovedBusPieceKeys = $derived.by(() => {
        return new Set(animatedRemovedBusPieces.map((piece) => piece.key))
    })

    function playerTextColor(playerId: string): string {
        const textColorClass = gameSession.colors.getPlayerTextColor(playerId)
        if (textColorClass.includes('text-black')) {
            return '#111'
        }
        if (textColorClass.includes('text-white')) {
            return '#ffffff'
        }

        const arbitraryMatch = textColorClass.match(/text-\[(#[0-9a-fA-F]{3,8})\]/)
        if (arbitraryMatch) {
            return arbitraryMatch[1]
        }

        return '#ffffff'
    }

    const buildingsRemaining = $derived(gameSession.gameState.numSitesRemainingForCurrentPhase())

    const buildingPhaseMarkerTextColor = $derived(
        BUILDING_PHASE_TEXT_COLOR_BY_PHASE[gameSession.gameState.currentBuildingPhase] ?? '#ffffff'
    )
</script>

{#each scoreMarkers as marker (marker.key)}
    <g
        class="score-marker pointer-events-none"
        use:animateScoreMarker={{ animator: scoreMarkerAnimator, markerKey: marker.key }}
        transform={`translate(${marker.point.x} ${marker.point.y})`}
        aria-hidden="true"
    >
        <circle
            cx="0"
            cy="0"
            r={SCORE_MARKER_RADIUS}
            fill={marker.fillColor}
            stroke={SCORE_MARKER_STROKE}
            stroke-width={SCORE_MARKER_STROKE_WIDTH}
        ></circle>
        <text
            x="0"
            y={SCORE_MARKER_TEXT_Y_OFFSET}
            text-anchor="middle"
            dominant-baseline="middle"
            font-size={SCORE_MARKER_TEXT_SIZE}
            font-weight="700"
            fill={marker.textColor}>{marker.score}</text
        >
    </g>
{/each}

<g class="pointer-events-none" {@attach attachAnimator(scoreMarkerAnimator)}></g>
<g class="pointer-events-none" {@attach attachAnimator(busPiecePlacementAnimator)}></g>

{#each busesTablePieces as piece (piece.key)}
    {#if !animatedAddedBusPieceKeys.has(piece.key) && !animatedRemovedBusPieceKeys.has(piece.key)}
        <ellipse
            cx={piece.point.x}
            cy={piece.point.y + BUS_TABLE_PIECE_SHADOW_OFFSET_Y}
            rx={BUS_TABLE_PIECE_SHADOW_RX}
            ry={BUS_TABLE_PIECE_SHADOW_RY}
            class="bus-piece-shadow pointer-events-none"
            aria-hidden="true"
        ></ellipse>
        <BusPieceIcon
            x={piece.point.x - BUS_TABLE_PIECE_WIDTH / 2}
            y={piece.point.y - BUS_TABLE_PIECE_HEIGHT / 2}
            width={BUS_TABLE_PIECE_WIDTH}
            height={BUS_TABLE_PIECE_HEIGHT}
            color={piece.color}
            class="pointer-events-none"
        />
    {/if}
{/each}

{#each animatedAddedBusPieces as animatedBusPiece (animatedBusPiece.key)}
    <g
        class="pointer-events-none"
        transform={`translate(${animatedBusPiece.x} ${animatedBusPiece.y}) scale(${animatedBusPiece.scale})`}
        opacity={animatedBusPiece.opacity}
        aria-hidden="true"
    >
        <ellipse
            cx="0"
            cy={BUS_TABLE_PIECE_SHADOW_OFFSET_Y}
            rx={BUS_TABLE_PIECE_SHADOW_RX}
            ry={BUS_TABLE_PIECE_SHADOW_RY}
            class="bus-piece-shadow"
        ></ellipse>
        <BusPieceIcon
            x={-BUS_TABLE_PIECE_WIDTH / 2}
            y={-BUS_TABLE_PIECE_HEIGHT / 2}
            width={BUS_TABLE_PIECE_WIDTH}
            height={BUS_TABLE_PIECE_HEIGHT}
            color={animatedBusPiece.color}
            class="pointer-events-none"
        />
    </g>
{/each}

{#each animatedRemovedBusPieces as animatedBusPiece (animatedBusPiece.key)}
    <g
        class="pointer-events-none"
        transform={`translate(${animatedBusPiece.x} ${animatedBusPiece.y}) scale(${animatedBusPiece.scale})`}
        opacity={animatedBusPiece.opacity}
        aria-hidden="true"
    >
        <ellipse
            cx="0"
            cy={BUS_TABLE_PIECE_SHADOW_OFFSET_Y}
            rx={BUS_TABLE_PIECE_SHADOW_RX}
            ry={BUS_TABLE_PIECE_SHADOW_RY}
            class="bus-piece-shadow"
        ></ellipse>
        <BusPieceIcon
            x={-BUS_TABLE_PIECE_WIDTH / 2}
            y={-BUS_TABLE_PIECE_HEIGHT / 2}
            width={BUS_TABLE_PIECE_WIDTH}
            height={BUS_TABLE_PIECE_HEIGHT}
            color={animatedBusPiece.color}
            class="pointer-events-none"
        />
    </g>
{/each}

<g class="pointer-events-none" aria-hidden="true">
    <text
        x={BUS_PASSENGER_SUPPLY_TEXT_POINT.x}
        y={BUS_PASSENGER_SUPPLY_TEXT_POINT.y}
        text-anchor="middle"
        dominant-baseline="middle"
        font-size={PASSENGER_SUPPLY_FONT_SIZE}
        font-weight="700"
        fill="#333333"
        stroke="#f4efe3"
        stroke-width="3"
        paint-order="stroke fill"
    >
        {gameSession.gameState.passengers.length}
    </text>
</g>

<g class="pointer-events-none" aria-hidden="true">
    <text
        x={BUS_BUILDING_SUPPLY_TEXT_POINT.x}
        y={BUS_BUILDING_SUPPLY_TEXT_POINT.y}
        text-anchor="middle"
        dominant-baseline="middle"
        font-size={BUILDING_SUPPLY_FONT_SIZE}
        font-weight="700"
        fill="#333333"
        stroke="#f4efe3"
        stroke-width="3"
        paint-order="stroke fill"
    >
        {buildingsRemaining}
    </text>
    <circle
        cx={BUS_BUILDING_PHASE_MARKER_POINT.x}
        cy={BUS_BUILDING_PHASE_MARKER_POINT.y}
        r={BUILDING_PHASE_MARKER_RADIUS}
        fill="#15121b"
    ></circle>
    <text
        x={BUS_BUILDING_PHASE_MARKER_POINT.x}
        y={BUS_BUILDING_PHASE_MARKER_POINT.y + 2}
        text-anchor="middle"
        dominant-baseline="middle"
        font-size={BUILDING_PHASE_MARKER_TEXT_SIZE}
        font-weight="700"
        fill={buildingPhaseMarkerTextColor}
    >
        {gameSession.gameState.currentBuildingPhase}
    </text>
</g>

<style>
    .bus-piece-shadow {
        fill: rgba(8, 12, 20, 0.42);
        opacity: 0.7;
        filter: blur(1.6px);
    }
</style>
