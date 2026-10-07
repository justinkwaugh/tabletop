<script lang="ts">
    import {
        FountainGlintsPatternId,
        FountainGlintsTileSize,
        FountainRimShadeId,
        FountainWaterFilterId,
        FountainWaterShadeId
    } from '$lib/utils/fountainShape.js'
</script>

<filter
    id={FountainWaterFilterId}
    filterUnits="userSpaceOnUse"
    x="0"
    y="0"
    width={FountainGlintsTileSize}
    height={FountainGlintsTileSize}
>
    <feTurbulence
        type="fractalNoise"
        baseFrequency="0.06"
        numOctaves="3"
        seed="8"
        stitchTiles="stitch"
    ></feTurbulence>
    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 -0.35"
    ></feColorMatrix>
</filter>
<pattern
    id={FountainGlintsPatternId}
    width={FountainGlintsTileSize}
    height={FountainGlintsTileSize}
    patternUnits="userSpaceOnUse"
>
    <rect
        width={FountainGlintsTileSize}
        height={FountainGlintsTileSize}
        filter="url(#{FountainWaterFilterId})"
    ></rect>
</pattern>
<linearGradient id={FountainRimShadeId} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f1d6cc"></stop>
    <stop offset="0.5" stop-color="#e6c3b8"></stop>
    <stop offset="1" stop-color="#c9a097"></stop>
</linearGradient>
<radialGradient id={FountainWaterShadeId} cx="50%" cy="50%" r="55%">
    <stop offset="0" stop-color="#a9d6e6"></stop>
    <stop offset="1" stop-color="#5f9fba"></stop>
</radialGradient>
