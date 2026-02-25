<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    type TurnOrderDisc = {
        playerId: string
        x: number
        y: number
        color: string
    }

    let {
        selectedPlayerId = null,
        selectable = false,
        onSelectPlayer
    }: {
        selectedPlayerId?: string | null
        selectable?: boolean
        onSelectPlayer?: (playerId: string) => void
    } = $props()

    const gameSession = getGameSession()

    const TURN_ORDER_SLOT_CENTERS: readonly Point[] = [
        { x: 2213.5, y: 110 },
        { x: 2295, y: 110 },
        { x: 2376.5, y: 110 },
        { x: 2458, y: 110 },
        { x: 2539.5, y: 110 }
    ]

    const TURN_ORDER_DISC_RADIUS = 22
    const TURN_ORDER_DISC_HIT_RADIUS = 28
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

    function selectPlayer(playerId: string): void {
        if (!selectable) {
            return
        }
        onSelectPlayer?.(playerId)
    }
</script>

<g class="select-none" aria-label="Turn order track markers">
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

        {#if selectable}
            <circle
                cx={disc.x}
                cy={disc.y}
                r={TURN_ORDER_DISC_HIT_RADIUS}
                fill="#ffffff"
                fill-opacity="0.001"
                stroke="none"
                pointer-events="all"
                cursor="pointer"
                onpointerdown={() => {
                    selectPlayer(disc.playerId)
                }}
            ></circle>
        {/if}
    {/each}
</g>
