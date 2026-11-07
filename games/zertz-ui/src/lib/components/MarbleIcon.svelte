<script lang="ts">
    import { MARBLE_COLORS, type MarbleColor } from '@tabletop/zertz'
    import { MARBLE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import { SPECK_DENSITY } from '$lib/board/marbleSpecks.js'
    import MarbleLook from './MarbleLook.svelte'

    let {
        color,
        size = 18,
        faded = false
    }: { color: MarbleColor; size?: number; faded?: boolean } = $props()

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
    <MarbleLook
        {color}
        seed={MARBLE_COLORS.indexOf(color) + 1}
        view={VIEW}
        speckDensity={SPECK_DENSITY * 0.28}
        speckGrowth={1.7}
    />
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
