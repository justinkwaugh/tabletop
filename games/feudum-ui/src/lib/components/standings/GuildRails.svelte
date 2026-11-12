<script lang="ts">
    import type { GuildStandingsView } from '$lib/model/guildStandings.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        BoardHeight,
        GuildAreaHeight,
        GuildAreas,
        RailBeside,
        RailOver,
        railOverRect,
        westGuild
    } from '$lib/utils/boardGeometry.js'
    import GuildRail from './GuildRail.svelte'

    /**
     * Contract, Guild standings: one column's rails, in board units. Beside the board on a desk,
     * each level with its guild's area; over the map's inner edge in a phone's guild view.
     */
    let {
        view,
        paintOf,
        side,
        over = false
    }: {
        view: GuildStandingsView
        paintOf: (playerId: string) => SeatPaint
        side: 'west' | 'east'
        over?: boolean
    } = $props()

    let rows = $derived(view.rows.filter((row) => westGuild(row.guild) === (side === 'west')))
    let scale = $derived(over ? RailOver.scale : RailBeside.scale)

    function placeOf(row: (typeof view.rows)[number]): string {
        if (over) {
            const { x, y, width, height } = railOverRect(row.guild)
            return `left:${x}px;top:${y}px;width:${width}px;height:${height}px`
        }
        return `left:0px;top:${GuildAreas[row.guild].y}px;width:${RailBeside.width}px;height:${GuildAreaHeight}px`
    }

    function drawingOf(row: (typeof view.rows)[number]): string {
        const { width, height } = over
            ? railOverRect(row.guild)
            : { width: RailBeside.width, height: GuildAreaHeight }
        return `width:${width / scale}px;height:${height / scale}px;transform:scale(${scale})`
    }
</script>

<div
    class="rails"
    class:over
    style={over ? undefined : `width:${RailBeside.width}px;height:${BoardHeight}px`}
    data-guild-rails={side}
>
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
        position: relative;
        flex: none;
        pointer-events: none;
    }

    .rails.over {
        position: absolute;
        inset: 0;
    }

    .slot {
        position: absolute;
    }

    .drawing {
        transform-origin: 0 0;
    }
</style>
