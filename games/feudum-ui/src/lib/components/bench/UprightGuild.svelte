<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { HydratedFeudumGameState } from '@tabletop/feudum'
    import GuildArea from '$lib/components/guilds/GuildArea.svelte'
    import UprightArea from '$lib/components/guilds/UprightArea.svelte'
    import { guildTarget } from '$lib/model/boardOffer.js'
    import type { BenchAreaView } from '$lib/model/benchView.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { GuildBox } from '$lib/utils/boardGeometry.js'

    /** Contract, The trade picker: read, not placed, so it takes no press. */
    let {
        area,
        height,
        state,
        paintOf,
        colourPaintOf
    }: {
        area: BenchAreaView
        height: number
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
    } = $props()

    const percent = (value: number, whole: number) => `${(value / whole) * 100}%`
</script>

<UprightArea
    guild={area.guild}
    long={height}
    class="overflow-hidden rounded-md border border-feudum-frame"
    data-upright-guild={area.guild}
    data-pick={guildTarget(area.guild)}
>
    <GuildArea guild={area.guild} {state} {paintOf} {colourPaintOf} width={height} />
    {#each area.placed as { item, box } (item.id)}
        <span
            class="ring pointer-events-none absolute {item.role}"
            class:round={box.round}
            style:left={percent(box.x, GuildBox.width)}
            style:top={percent(box.y, GuildBox.height)}
            style:width={percent(box.width, GuildBox.width)}
            style:height={percent(box.height, GuildBox.height)}
            data-bench-place={item.id}
            data-bench-role={item.role}
        ></span>
    {/each}
</UprightArea>

<style>
    .ring {
        border-radius: 8px;
    }

    .ring.round {
        border-radius: 50%;
    }

    .ring.lit {
        outline: 3px solid var(--feudum-accent);
        outline-offset: -3px;
        box-shadow: 0 0 0 2px var(--feudum-halo);
    }

    .ring.picked {
        outline: 5px solid var(--feudum-accent);
        outline-offset: -5px;
        background: color-mix(in srgb, var(--feudum-accent) 35%, transparent);
        box-shadow: 0 0 0 2px var(--feudum-halo);
    }

    .ring.dimmed {
        background: var(--feudum-dim);
    }
</style>
