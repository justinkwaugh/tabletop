<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import {
        CUBE_GRAIN,
        CUBE_LEFT,
        CUBE_LETTER,
        CUBE_OUTLINE,
        CUBE_RIGHT,
        CUBE_TOP,
        CUBE_UNITS,
        CUBE_WORN_EDGE,
        cubeShading
    } from '$lib/utils/cubeShape.js'

    let {
        railroadId,
        x,
        y,
        width,
        wood,
        lettered
    }: {
        railroadId: RailroadId
        x: number
        y: number
        width: number
        /** Wood: gradients, grain and a worn edge; otherwise flat shaded faces. */
        wood: boolean
        lettered: boolean
    } = $props()

    const shading = cubeShading()
    const style = $derived(railroadStyle(railroadId))
    const scale = $derived(width / CUBE_UNITS.width)
</script>

<!-- Art plan, Cube: the railroad's colour on every face, its sides shaded, its letter on top. -->
<g transform="translate({x} {y}) scale({scale})" aria-hidden="true" data-cube={style.monogram}>
    <polygon
        points={CUBE_OUTLINE}
        fill={style.fill}
        stroke="var(--rtr-cube-edge)"
        stroke-width="0.8"
        stroke-linejoin="round"
    ></polygon>
    {#if wood}
        <polygon points={CUBE_LEFT} fill="url(#{shading.left})"></polygon>
        <polygon points={CUBE_RIGHT} fill="url(#{shading.right})"></polygon>
        <polygon points={CUBE_TOP} fill="url(#{shading.top})"></polygon>
        <path
            d={CUBE_GRAIN}
            fill="none"
            stroke="var(--rtr-cube-shade)"
            stroke-opacity="0.3"
            stroke-width="0.32"
            stroke-linecap="round"
        ></path>
        <path
            d={CUBE_WORN_EDGE}
            fill="none"
            stroke="var(--rtr-cube-sheen)"
            stroke-opacity="0.45"
            stroke-width="0.42"
            stroke-linecap="round"
            stroke-linejoin="round"
        ></path>
    {:else}
        <polygon points={CUBE_LEFT} fill="var(--rtr-cube-shade)" fill-opacity="0.22"></polygon>
        <polygon points={CUBE_RIGHT} fill="var(--rtr-cube-shade)" fill-opacity="0.4"></polygon>
    {/if}
    {#if lettered}
        <text
            y={CUBE_LETTER.y}
            font-size={CUBE_LETTER.fontSize}
            font-weight="800"
            text-anchor="middle"
            fill={style.ink}>{style.monogram}</text
        >
    {/if}
</g>
