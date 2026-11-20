<script lang="ts">
    import type { GuildStandingsView } from '$lib/model/guildStandings.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { RailOver, railOverRect, westGuild } from '$lib/utils/boardGeometry.js'
    import GuildRail from './GuildRail.svelte'

    /**
     * Contract, Guild standings: one column's rails, in board units, over the map's inner edge in a
     * phone's guild view, each level with its area.
     */
    let {
        view,
        paintOf,
        side
    }: {
        view: GuildStandingsView
        paintOf: (playerId: string) => SeatPaint
        side: 'west' | 'east'
    } = $props()

    let rows = $derived(view.rows.filter((row) => westGuild(row.guild) === (side === 'west')))

    function placeOf(row: (typeof view.rows)[number]): string {
        const { x, y, width, height } = railOverRect(row.guild)
        return `left:${x}px;top:${y}px;width:${width}px;height:${height}px`
    }

    function drawingOf(row: (typeof view.rows)[number]): string {
        const { width, height } = railOverRect(row.guild)
        const scale = RailOver.scale
        return `width:${width / scale}px;height:${height / scale}px;transform:scale(calc(${scale} * var(--render-zoom, 1)))`
    }
</script>

<div class="rails" data-guild-rails={side}>
    {#each rows as row (row.guild)}
        <div class="slot" style={placeOf(row)} data-guild-rail={row.guild}>
            <div class="drawing" style={drawingOf(row)}>
                <GuildRail {row} {paintOf} />
            </div>
        </div>
    {/each}
</div>

<style>
    .rails {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .slot {
        position: absolute;
    }

    /*
     * HTML under the board's view-scale zoom would be laid out again at each zoom and hit Safari's
     * 9px text floor: the drawing takes the zoom off and is scaled by its transform instead.
     */
    .drawing {
        zoom: var(--render-unzoom, 1);
        transform-origin: 0 0;
    }
</style>
