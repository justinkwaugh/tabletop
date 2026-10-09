<script lang="ts">
    import {
        FountainGlintsPatternId,
        FountainRimShadeId,
        FountainWaterShadeId
    } from '$lib/utils/fountainShape.js'
    import { BoardTextures } from '$lib/utils/boardTextures.js'
    import FountainGlintsTexture from '$lib/textures/fountain-glints.webp'

    const glints = BoardTextures.fountainGlints
</script>

<pattern
    id={FountainGlintsPatternId}
    width={glints.size}
    height={glints.size}
    patternUnits="userSpaceOnUse"
>
    <image href={FountainGlintsTexture} width={glints.size} height={glints.size}></image>
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
