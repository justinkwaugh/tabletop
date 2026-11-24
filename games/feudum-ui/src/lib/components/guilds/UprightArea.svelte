<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { HTMLAttributes } from 'svelte/elements'
    import type { GuildId } from '@tabletop/feudum'
    import { GuildBox, uprightTransform, uprightTurn } from '$lib/utils/boardGeometry.js'
    import { setPieceTurn } from './pieceTurn.js'

    /** R-1.2.3 The print lies on its side on the board, so off it the area stands upright. */
    let {
        guild,
        long,
        children,
        ...rest
    }: { guild: GuildId; long: number; children: Snippet } & HTMLAttributes<HTMLDivElement> =
        $props()

    let turn = $derived(uprightTurn(guild))
    setPieceTurn(() => -turn)

    let short = $derived((long * GuildBox.height) / GuildBox.width)
</script>

<div {...rest} style:width="{short}px" style:height="{long}px" data-upright-area={guild}>
    <div
        class="turned"
        style:width="{long}px"
        style:height="{short}px"
        style:transform={uprightTransform(guild)}
        style:--piece-turn="{-turn}deg"
        data-upright-turned
    >
        {@render children()}
    </div>
</div>

<style>
    [data-upright-area] {
        position: relative;
        flex: none;
    }

    .turned {
        position: absolute;
        left: 50%;
        top: 50%;
    }

    .turned > :global(svg) {
        display: block;
    }
</style>
