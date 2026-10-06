<script lang="ts">
    import {
        CobbleBevelFilterId,
        CobbleGrainFilterId,
        CobbleMortar,
        CobblePatternId,
        Cobbles,
        CobbleTileSize
    } from '$lib/utils/cobbles.js'

    const BevelMargin = 40
</script>

<filter
    id={CobbleBevelFilterId}
    filterUnits="userSpaceOnUse"
    x={-BevelMargin}
    y={-BevelMargin}
    width={CobbleTileSize + 2 * BevelMargin}
    height={CobbleTileSize + 2 * BevelMargin}
>
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="height"></feGaussianBlur>
    <feDiffuseLighting
        in="height"
        surfaceScale="1.9"
        diffuseConstant="1.05"
        lighting-color="#ffffff"
        result="light"
    >
        <feDistantLight azimuth="225" elevation="52"></feDistantLight>
    </feDiffuseLighting>
    <feComposite in="light" in2="SourceAlpha" operator="in" result="stoneLight"></feComposite>
    <feBlend in="SourceGraphic" in2="stoneLight" mode="multiply"></feBlend>
</filter>
<filter
    id={CobbleGrainFilterId}
    filterUnits="userSpaceOnUse"
    x="0"
    y="0"
    width={CobbleTileSize}
    height={CobbleTileSize}
>
    <feTurbulence
        type="fractalNoise"
        baseFrequency="0.1125"
        numOctaves="3"
        seed="3"
        stitchTiles="stitch"
    ></feTurbulence>
    <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.17  0 0 0 0.35 -0.08"
    ></feColorMatrix>
</filter>
<pattern
    id={CobblePatternId}
    width={CobbleTileSize}
    height={CobbleTileSize}
    patternUnits="userSpaceOnUse"
>
    <rect width={CobbleTileSize} height={CobbleTileSize} fill={CobbleMortar}></rect>
    <g filter="url(#{CobbleBevelFilterId})">
        {#each Cobbles as cobble, index (index)}
            <path
                d={cobble.path}
                fill={cobble.fill}
                stroke={cobble.fill}
                stroke-width="0.6"
                stroke-linejoin="round"
            ></path>
        {/each}
    </g>
    <rect width={CobbleTileSize} height={CobbleTileSize} filter="url(#{CobbleGrainFilterId})"
    ></rect>
</pattern>
