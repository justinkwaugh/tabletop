<svelte:options namespace="svg" />

<script lang="ts">
    import type { MarbleColor } from '@tabletop/zertz'
    import { MARBLE_RADIUS, type BoardView } from '$lib/board/geometry.js'
    import { marbleBox, marbleLook, SHINE_LOOK } from '$lib/board/looks.js'
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import { speckPaths } from '$lib/board/marbleSpecks.js'

    // A marble about its centre: its colour's lit body, its own specks, and the shine over them.
    // Icons draw fewer, larger specks; the looks page passes the images it has just drawn.
    let {
        color,
        seed,
        view,
        speckDensity,
        speckGrowth,
        urls = LOOK_URLS
    }: {
        color: MarbleColor
        seed: number
        view: BoardView
        speckDensity?: number
        speckGrowth?: number
        urls?: Record<string, string>
    } = $props()

    const box = marbleBox()
    const specks = $derived(speckPaths(view, color, seed, speckDensity, speckGrowth))
</script>

<circle r={MARBLE_RADIUS} class="marble-hit"></circle>
<image
    href={urls[marbleLook(color)]}
    x={box.x}
    y={box.y}
    width={box.width}
    height={box.height}
    pointer-events="none"
></image>
{#each specks as speck (speck.fill)}
    <path d={speck.d} fill={speck.fill} pointer-events="none"></path>
{/each}
<image
    href={urls[SHINE_LOOK]}
    x={box.x}
    y={box.y}
    width={box.width}
    height={box.height}
    pointer-events="none"
></image>

<style>
    .marble-hit {
        fill: transparent;
    }
</style>
