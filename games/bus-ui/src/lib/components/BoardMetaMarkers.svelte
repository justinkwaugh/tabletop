<script lang="ts">
    import { Color, type Point } from '@tabletop/common'
    import {
        BUS_BUSES_TABLE_SLOT_POINTS_BY_COLOR,
        BUS_PASSENGER_SUPPLY_TEXT_POINT,
        BUS_SCORE_TRACK_POINTS
    } from '$lib/definitions/busBoardGraph.js'
    import BusPieceIcon from '$lib/images/BusPieceIcon.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const SCORE_MARKER_RADIUS = 17
    const SCORE_MARKER_STACK_OFFSET_Y = 5
    const SCORE_MARKER_STROKE = '#1f2a3d'
    const SCORE_MARKER_STROKE_WIDTH = 1.4
    const SCORE_MARKER_TEXT_SIZE = 13
    const SCORE_MARKER_TEXT_Y_OFFSET = 0.8
    const BUS_TABLE_PIECE_WIDTH = 58
    const BUS_TABLE_PIECE_HEIGHT = 31
    const PASSENGER_SUPPLY_FONT_SIZE = 26

    type ScoreMarker = {
        key: string
        point: Point
        score: number
        textColor: string
        fillColor: string
    }

    type BusesTablePiece = {
        key: string
        point: Point
        color: string
    }

    const scoreMarkers: ScoreMarker[] = $derived.by(() => {
        const state = gameSession.gameState
        const playerById = new Map(state.players.map((player) => [player.playerId, player]))
        const markers: ScoreMarker[] = []
        const stackOffsetsByScore = new Map<number, number>()

        for (const playerId of state.scoreOrder) {
            const player = playerById.get(playerId)
            if (!player) {
                continue
            }

            const score = Math.max(0, Math.round(player.score))
            const scoreIndex = Math.min(score, BUS_SCORE_TRACK_POINTS.length - 1)
            const scorePoint = BUS_SCORE_TRACK_POINTS[scoreIndex]
            if (!scorePoint) {
                continue
            }

            const stackIndex = stackOffsetsByScore.get(score) ?? 0
            stackOffsetsByScore.set(score, stackIndex + 1)

            markers.push({
                key: `score:${playerId}`,
                point: {
                    x: scorePoint.x,
                    y: scorePoint.y - stackIndex * SCORE_MARKER_STACK_OFFSET_Y
                },
                score,
                textColor: playerTextColor(playerId),
                fillColor: gameSession.colors.getPlayerUiColor(playerId)
            })
        }

        return markers
    })

    const busesTablePieces: BusesTablePiece[] = $derived.by(() => {
        const pieces: BusesTablePiece[] = []
        const state = gameSession.gameState

        for (const playerState of state.players) {
            const columnKey = busesTableColumnKeyForColor(playerState.color)
            if (!columnKey) {
                continue
            }

            const slots = BUS_BUSES_TABLE_SLOT_POINTS_BY_COLOR[columnKey]
            if (!slots?.length) {
                continue
            }

            const pieceCount = Math.max(0, Math.min(Math.round(playerState.buses), slots.length))
            const color = gameSession.colors.getPlayerUiColor(playerState.playerId)
            for (let i = 0; i < pieceCount; i += 1) {
                const point = slots[i]
                if (!point) {
                    continue
                }

                pieces.push({
                    key: `buses:${playerState.playerId}:${i}`,
                    point,
                    color
                })
            }
        }

        return pieces
    })

    function busesTableColumnKeyForColor(
        color: Color | undefined
    ): keyof typeof BUS_BUSES_TABLE_SLOT_POINTS_BY_COLOR | undefined {
        switch (color) {
            case Color.Purple:
                return 'purple'
            case Color.Blue:
                return 'blue'
            case Color.Green:
                return 'green'
            case Color.Yellow:
                return 'yellow'
            case Color.Red:
                return 'red'
            default:
                return undefined
        }
    }

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
</script>

{#each scoreMarkers as marker (marker.key)}
    <g class="pointer-events-none" aria-hidden="true">
        <circle
            cx={marker.point.x}
            cy={marker.point.y}
            r={SCORE_MARKER_RADIUS}
            fill={marker.fillColor}
            stroke={SCORE_MARKER_STROKE}
            stroke-width={SCORE_MARKER_STROKE_WIDTH}
        ></circle>
        <text
            x={marker.point.x}
            y={marker.point.y + SCORE_MARKER_TEXT_Y_OFFSET}
            text-anchor="middle"
            dominant-baseline="middle"
            font-size={SCORE_MARKER_TEXT_SIZE}
            font-weight="700"
            fill={marker.textColor}>{marker.score}</text
        >
    </g>
{/each}

{#each busesTablePieces as piece (piece.key)}
    <BusPieceIcon
        x={piece.point.x - BUS_TABLE_PIECE_WIDTH / 2}
        y={piece.point.y - BUS_TABLE_PIECE_HEIGHT / 2}
        width={BUS_TABLE_PIECE_WIDTH}
        height={BUS_TABLE_PIECE_HEIGHT}
        color={piece.color}
        class="pointer-events-none"
    />
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
