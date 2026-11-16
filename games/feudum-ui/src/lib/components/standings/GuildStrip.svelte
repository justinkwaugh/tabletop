<script lang="ts">
    import type { GuildStandingsView } from '$lib/model/guildStandings.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        DeskBoardArea,
        GuildAreas,
        StandingsStrip,
        StripRailScale,
        StripRailWidth,
        standingsStripHeight,
        stripRailDrawingHeight,
        westGuild
    } from '$lib/utils/boardGeometry.js'
    import GuildRail from './GuildRail.svelte'

    /**
     * Contract, Guild standings: on a desk the six rails stand in one strip under the board, in board
     * units so they scale with it: the West guilds' then the East's, each in its area's order down
     * its edge, spelled out so nothing needs a hover.
     */
    let {
        view,
        paintOf,
        seats
    }: {
        view: GuildStandingsView
        paintOf: (playerId: string) => SeatPaint
        seats: number
    } = $props()

    /** West before East, then down the edge, as the areas stand on the board. */
    let rows = $derived(
        [...view.rows].sort(
            (a, b) =>
                Number(westGuild(b.guild)) - Number(westGuild(a.guild)) ||
                GuildAreas[a.guild].y - GuildAreas[b.guild].y
        )
    )
    let drawingHeight = $derived(stripRailDrawingHeight(seats))
    let height = $derived(standingsStripHeight(seats))
</script>

<div
    class="strip"
    style="width:{DeskBoardArea.width}px;height:{height}px;padding-top:{StandingsStrip.gap}px;gap:{StandingsStrip.gap}px"
    data-guild-strip
>
    {#each rows as row, index (row.guild)}
        {@const east = !westGuild(row.guild)}
        <div
            class="slot"
            style="width:{StripRailWidth}px;height:{drawingHeight * StripRailScale}px"
            style:margin-left={east && westGuild(rows[index - 1]?.guild ?? row.guild)
                ? `${StandingsStrip.divide}px`
                : undefined}
            data-guild-rail={row.guild}
            data-strip-east={east ? '' : undefined}
        >
            <div
                class="drawing"
                style="width:{StandingsStrip.drawing
                    .width}px;height:{drawingHeight}px;transform:scale({StripRailScale})"
            >
                <GuildRail {row} {paintOf} spelled />
            </div>
        </div>
    {/each}
</div>

<style>
    .strip {
        display: flex;
        box-sizing: border-box;
        pointer-events: none;
    }

    .slot {
        flex: none;
    }

    .drawing {
        transform-origin: 0 0;
    }
</style>
