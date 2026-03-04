<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { MachineState } from '@tabletop/indonesia'

    type TurnOrderDisc = {
        playerId: string
        x: number
        y: number
        color: string
    }

    type TurnOrderHitRect = {
        playerId: string
        x: number
        y: number
        width: number
        height: number
    }

    let {
        selectedPlayerId = null,
        selectable = false,
        onSelectPlayer,
        onHoverPlayer
    }: {
        selectedPlayerId?: string | null
        selectable?: boolean
        onSelectPlayer?: (playerId: string) => void
        onHoverPlayer?: (playerId: string | null) => void
    } = $props()

    const gameSession = getGameSession()

    const TURN_ORDER_SLOT_CENTERS: readonly Point[] = [
        { x: 2213.5, y: 110 },
        { x: 2295, y: 110 },
        { x: 2376.5, y: 110 },
        { x: 2458, y: 110 },
        { x: 2539.5, y: 110 }
    ]

    const TURN_ORDER_SLOT_HALF_SPACING = TURN_ORDER_SLOT_CENTERS.slice(1).reduce(
        (minimum, slot, index) =>
            Math.min(minimum, Math.abs(slot.x - TURN_ORDER_SLOT_CENTERS[index]!.x) / 2),
        Number.POSITIVE_INFINITY
    )
    const TURN_ORDER_DISC_RADIUS = 22
    const TURN_ORDER_HIT_RECT_HALF_HEIGHT = 29
    const TURN_ORDER_HELP_TEXT = 'Click a disc to select hull target'
    const TURN_ORDER_HELP_TEXT_COLOR = '#6f5238'
    const TURN_ORDER_HELP_TEXT_SIZE = 24
    const TURN_ORDER_HELP_TEXT_Y = 71 - TURN_ORDER_HELP_TEXT_SIZE * 1.5
    const TURN_ORDER_HELP_CENTER_X =
        (TURN_ORDER_SLOT_CENTERS[0]!.x +
            TURN_ORDER_SLOT_CENTERS[TURN_ORDER_SLOT_CENTERS.length - 1]!.x) /
        2
    const TURN_ORDER_DISC_STROKE = '#1f2937'
    const TURN_ORDER_DISC_STROKE_WIDTH = 2
    const TURN_ORDER_DISC_OPACITY = 0.95
    const TURN_ORDER_SELECTED_OUTER_RADIUS = TURN_ORDER_DISC_RADIUS + 7
    const TURN_ORDER_SELECTED_INNER_RADIUS = TURN_ORDER_DISC_RADIUS + 3.5
    const TURN_ORDER_SELECTED_OUTER_STROKE = '#111827'
    const TURN_ORDER_SELECTED_INNER_STROKE = '#f8fafc'
    const TURN_ORDER_SELECTED_OUTER_STROKE_WIDTH = 4
    const TURN_ORDER_SELECTED_INNER_STROKE_WIDTH = 2.2

    const turnOrderDiscs: TurnOrderDisc[] = $derived.by(() => {
        const discs: TurnOrderDisc[] = []
        const turnOrder = gameSession.gameState.turnManager.turnOrder

        const count = Math.min(turnOrder.length, TURN_ORDER_SLOT_CENTERS.length)
        for (let index = 0; index < count; index += 1) {
            const playerId = turnOrder[index]
            const slot = TURN_ORDER_SLOT_CENTERS[index]

            discs.push({
                playerId,
                x: slot.x,
                y: slot.y,
                color: gameSession.colors.getPlayerUiColor(playerId)
            })
        }

        return discs
    })

    const turnOrderHitRects: TurnOrderHitRect[] = $derived.by(() => {
        const rects: TurnOrderHitRect[] = []
        for (let index = 0; index < turnOrderDiscs.length; index += 1) {
            const disc = turnOrderDiscs[index]
            if (!disc) {
                continue
            }

            const previousDisc = turnOrderDiscs[index - 1]
            const nextDisc = turnOrderDiscs[index + 1]
            const leftBoundary = previousDisc
                ? (previousDisc.x + disc.x) / 2
                : disc.x - TURN_ORDER_SLOT_HALF_SPACING
            const rightBoundary = nextDisc
                ? (disc.x + nextDisc.x) / 2
                : disc.x + TURN_ORDER_SLOT_HALF_SPACING

            rects.push({
                playerId: disc.playerId,
                x: leftBoundary - 1,
                y: disc.y - TURN_ORDER_HIT_RECT_HALF_HEIGHT,
                width: rightBoundary - leftBoundary + 2,
                height: TURN_ORDER_HIT_RECT_HALF_HEIGHT * 2
            })
        }

        return rects
    })

    const showTurnOrderHelpText: boolean = $derived.by(
        () => gameSession.gameState.machineState === MachineState.ResearchAndDevelopment
    )

    function selectPlayer(playerId: string): void {
        if (!selectable) {
            return
        }
        onSelectPlayer?.(playerId)
    }
</script>

<g class="select-none" aria-label="Turn order track markers">
    {#if showTurnOrderHelpText && turnOrderDiscs.length > 0}
        <text
            x={TURN_ORDER_HELP_CENTER_X}
            y={TURN_ORDER_HELP_TEXT_Y}
            text-anchor="middle"
            fill={TURN_ORDER_HELP_TEXT_COLOR}
            font-size={TURN_ORDER_HELP_TEXT_SIZE}
            font-weight="400"
            letter-spacing="0.01em"
            pointer-events="none"
        >
            {TURN_ORDER_HELP_TEXT}
        </text>
    {/if}

    {#each turnOrderDiscs as disc (disc.playerId)}
        {#if selectedPlayerId === disc.playerId}
            <circle
                cx={disc.x}
                cy={disc.y}
                r={TURN_ORDER_SELECTED_OUTER_RADIUS}
                fill="none"
                stroke={TURN_ORDER_SELECTED_OUTER_STROKE}
                stroke-width={TURN_ORDER_SELECTED_OUTER_STROKE_WIDTH}
                opacity={0.88}
                pointer-events="none"
            ></circle>
            <circle
                cx={disc.x}
                cy={disc.y}
                r={TURN_ORDER_SELECTED_INNER_RADIUS}
                fill="none"
                stroke={TURN_ORDER_SELECTED_INNER_STROKE}
                stroke-width={TURN_ORDER_SELECTED_INNER_STROKE_WIDTH}
                opacity={0.98}
                pointer-events="none"
            ></circle>
        {/if}
        <circle
            cx={disc.x}
            cy={disc.y}
            r={TURN_ORDER_DISC_RADIUS}
            fill={disc.color}
            stroke={TURN_ORDER_DISC_STROKE}
            stroke-width={TURN_ORDER_DISC_STROKE_WIDTH}
            opacity={TURN_ORDER_DISC_OPACITY}
            pointer-events="none"
        ></circle>

        {@const hitRect = turnOrderHitRects.find((rect) => rect.playerId === disc.playerId)}
        <rect
            x={hitRect?.x ?? disc.x - 28}
            y={hitRect?.y ?? disc.y - TURN_ORDER_HIT_RECT_HALF_HEIGHT}
            width={hitRect?.width ?? 56}
            height={hitRect?.height ?? TURN_ORDER_HIT_RECT_HALF_HEIGHT * 2}
            fill="#ffffff"
            fill-opacity="0.001"
            stroke="none"
            pointer-events="all"
            cursor={selectable ? 'pointer' : 'default'}
            onpointerenter={() => {
                onHoverPlayer?.(disc.playerId)
            }}
            onpointerleave={() => {
                onHoverPlayer?.(null)
            }}
            onpointerdown={() => {
                selectPlayer(disc.playerId)
            }}
        ></rect>
    {/each}
</g>
