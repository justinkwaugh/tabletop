<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    type TurnOrderDisc = {
        key: string
        x: number
        y: number
        color: string
    }

    const gameSession = getGameSession()

    const TURN_ORDER_SLOT_CENTERS: readonly Point[] = [
        { x: 2213.5, y: 110 },
        { x: 2295, y: 110 },
        { x: 2376.5, y: 110 },
        { x: 2458, y: 110 },
        { x: 2539.5, y: 110 }
    ]

    const TURN_ORDER_DISC_RADIUS = 22
    const TURN_ORDER_DISC_STROKE = '#1f2937'
    const TURN_ORDER_DISC_STROKE_WIDTH = 2
    const TURN_ORDER_DISC_OPACITY = 0.95

    const turnOrderDiscs: TurnOrderDisc[] = $derived.by(() => {
        const discs: TurnOrderDisc[] = []
        const turnOrder = gameSession.gameState.turnManager.turnOrder

        const count = Math.min(turnOrder.length, TURN_ORDER_SLOT_CENTERS.length)
        for (let index = 0; index < count; index += 1) {
            const playerId = turnOrder[index]
            const slot = TURN_ORDER_SLOT_CENTERS[index]

            discs.push({
                key: playerId,
                x: slot.x,
                y: slot.y,
                color: gameSession.colors.getPlayerUiColor(playerId)
            })
        }

        return discs
    })
</script>

<g class="pointer-events-none select-none" aria-label="Turn order track markers">
    {#each turnOrderDiscs as disc (disc.key)}
        <circle
            cx={disc.x}
            cy={disc.y}
            r={TURN_ORDER_DISC_RADIUS}
            fill={disc.color}
            stroke={TURN_ORDER_DISC_STROKE}
            stroke-width={TURN_ORDER_DISC_STROKE_WIDTH}
            opacity={TURN_ORDER_DISC_OPACITY}
        ></circle>
    {/each}
</g>
