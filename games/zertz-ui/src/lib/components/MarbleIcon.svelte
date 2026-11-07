<script lang="ts">
    import { MARBLE_COLORS, type MarbleColor } from '@tabletop/zertz'
    import { MARBLE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import MarbleLook from './MarbleLook.svelte'

    // A marble off the board, specked as the board's are; `seed` gives it its own specks.
    let {
        color,
        seed = MARBLE_COLORS.indexOf(color) + 1,
        size = 18,
        faded = false
    }: { color: MarbleColor; seed?: number; size?: number; faded?: boolean } = $props()

    const r = MARBLE_RADIUS
</script>

<svg
    class="marble inline-block shrink-0"
    class:faded
    width={size}
    height={size}
    viewBox="{-r} {-r} {2 * r} {2 * r}"
    aria-hidden="true"
>
    <MarbleLook {color} {seed} view={VIEW} />
</svg>

<style>
    .marble {
        border-radius: 999px;
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
    }

    .faded {
        opacity: 0.22;
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.5);
    }
</style>
