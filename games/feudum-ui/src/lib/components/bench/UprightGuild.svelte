<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { HydratedFeudumGameState } from '@tabletop/feudum'
    import GuildArea from '$lib/components/guilds/GuildArea.svelte'
    import { guildTarget } from '$lib/model/boardOffer.js'
    import type { BenchAreaView } from '$lib/model/benchView.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { GuildBox } from '$lib/utils/boardGeometry.js'

    /**
     * Contract, The trade picker: the guild's area turned a quarter clockwise, so it stands upright
     * at a readable size. It lies sideways on the table; here it is read, not placed, so it takes no
     * press: its rings say which places the cards beside it offer.
     */
    let {
        area,
        height,
        state,
        paintOf,
        colourPaintOf
    }: {
        area: BenchAreaView
        /** In CSS pixels: the area's long side, upright. */
        height: number
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
    } = $props()

    const percent = (value: number, whole: number) => `${(value / whole) * 100}%`

    let width = $derived((height * GuildBox.height) / GuildBox.width)
</script>

<div
    class="upright relative shrink-0 overflow-hidden rounded-md border border-feudum-frame"
    style:width="{width}px"
    style:height="{height}px"
    data-upright-guild={area.guild}
    data-pick={guildTarget(area.guild)}
>
    <div class="turned absolute" style:width="{height}px" style:height="{width}px">
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
    </div>
</div>

<style>
    /* A quarter turn clockwise about the centre: the long side stands upright. */
    .turned {
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) rotate(90deg);
    }

    .turned > :global(svg) {
        display: block;
        width: 100%;
        height: 100%;
    }

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
