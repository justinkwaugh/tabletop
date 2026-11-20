<script lang="ts">
    import { columnRailScale, DeskColumnRailGap } from '$lib/model/boardFocus.svelte.js'
    import type { GuildStandingsView } from '$lib/model/guildStandings.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { GuildAreas, stripRailDrawingHeight, westGuild } from '$lib/utils/boardGeometry.js'
    import GuildRail from './GuildRail.svelte'

    /** Contract, Guild standings: a desk's side column, when the map's height binds. */
    let {
        view,
        paintOf,
        seats,
        perRow
    }: {
        view: GuildStandingsView
        paintOf: (playerId: string) => SeatPaint
        seats: number
        perRow: 1 | 2
    } = $props()

    let rows = $derived(
        [...view.rows].sort(
            (a, b) =>
                Number(westGuild(b.guild)) - Number(westGuild(a.guild)) ||
                GuildAreas[a.guild].y - GuildAreas[b.guild].y
        )
    )

    let width = $state(0)
    let height = $state(0)
    let scale = $derived(columnRailScale(height, seats, perRow))
    let drawingHeight = $derived(stripRailDrawingHeight(seats))
    let slot = $derived(Math.max(0, (width - (perRow - 1) * DeskColumnRailGap) / perRow))
</script>

<div
    class="column"
    class:paired={perRow === 2}
    style:gap="{DeskColumnRailGap}px"
    bind:clientWidth={width}
    bind:clientHeight={height}
    data-guild-column
>
    {#if scale > 0 && slot > 0}
        {#each rows as row (row.guild)}
            <div
                class="slot"
                style="width:{slot}px;height:{drawingHeight * scale}px"
                data-guild-rail={row.guild}
            >
                <div
                    class="drawing"
                    style="width:{slot / scale}px;height:{drawingHeight}px;transform:scale({scale})"
                >
                    <GuildRail {row} {paintOf} spelled />
                </div>
            </div>
        {/each}
    {/if}
</div>

<style>
    .column {
        display: grid;
        flex: 1 1 0;
        grid-template-columns: 100%;
        align-content: start;
        min-height: 0;
        overflow: hidden;
        pointer-events: none;
    }

    .column.paired {
        grid-template-rows: repeat(3, auto);
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-flow: column;
    }

    .drawing {
        transform-origin: 0 0;
    }
</style>
