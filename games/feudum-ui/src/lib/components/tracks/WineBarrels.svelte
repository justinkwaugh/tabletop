<script lang="ts">
    import type { HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        BarrelDisc,
        BarrelSize,
        BarrelSulfur,
        BarrelSulfurSize,
        TrackDiscSize,
        barrelCentre
    } from '$lib/utils/boardGeometry.js'
    import { BarrelPath } from '$lib/utils/trackShape.js'

    /** R-4.10.2 A seat's barrel holds 0 to 3 sulfur. */
    let {
        state,
        printed,
        paintOf,
        dim
    }: {
        state: HydratedFeudumGameState
        printed: boolean
        paintOf: (playerId: string) => SeatPaint
        dim?: number
    } = $props()
</script>

{#each state.players as player (player.playerId)}
    {@const centre = barrelCentre(player.color)}
    {@const paint = paintOf(player.playerId)}
    <g data-barrel={player.playerId} data-sulfur={player.barrel} opacity={dim}>
        {#if !printed}
            <svg
                x={centre.x - BarrelSize / 2}
                y={centre.y - BarrelSize / 2}
                width={BarrelSize}
                height={BarrelSize}
                viewBox="0 0 24 24"
                data-drawn-barrel
            >
                <path d={BarrelPath} fill={paint.fill} stroke={paint.edge} stroke-width="1"></path>
            </svg>
        {/if}
        <SeatToken
            kind="disc"
            {paint}
            size={TrackDiscSize}
            x={centre.x + BarrelDisc.x - TrackDiscSize / 2}
            y={centre.y + BarrelDisc.y - TrackDiscSize / 2}
        />
        {#each BarrelSulfur.slice(0, player.barrel) as offset, index (index)}
            <BoardPiece
                at={{ x: centre.x + offset.x, y: centre.y + offset.y }}
                piece="barrel:{player.playerId}:{index}"
            >
                <GoodToken
                    good="sulfur"
                    size={BarrelSulfurSize}
                    x={-BarrelSulfurSize / 2}
                    y={-BarrelSulfurSize / 2}
                />
            </BoardPiece>
        {/each}
    </g>
{/each}
