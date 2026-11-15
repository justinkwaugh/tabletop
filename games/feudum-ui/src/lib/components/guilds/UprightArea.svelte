<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { HTMLAttributes } from 'svelte/elements'
    import type { GuildId } from '@tabletop/feudum'
    import { GuildBox, uprightTransform, uprightTurn } from '$lib/utils/boardGeometry.js'
    import { setPieceTurn } from './pieceTurn.js'

    /**
     * R-1.2.3 A guild area off the board, stood upright: its print lies on its side on the board, so
     * what `children` draws in the area's own frame, `long` pixels wide, stands in a box turned a
     * quarter about its centre (contract: The bench, The trade picker, Card preview). Pieces and words
     * of ours inside turn back about their own centres (`pieceTurn`, `--piece-turn`).
     */
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
