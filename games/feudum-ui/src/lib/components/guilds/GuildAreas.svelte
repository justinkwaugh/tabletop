<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { GuildIds, type HydratedFeudumGameState } from '@tabletop/feudum'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { GuildAreas } from '$lib/utils/boardGeometry.js'
    import GuildArea from './GuildArea.svelte'

    /** R-1.2.3 The six guild areas where they stand on the board. */
    let {
        state,
        paintOf,
        colourPaintOf
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
    } = $props()
</script>

{#each GuildIds as guild (guild)}
    <GuildArea
        {guild}
        {state}
        {paintOf}
        {colourPaintOf}
        x={GuildAreas[guild].x}
        y={GuildAreas[guild].y}
    />
{/each}
