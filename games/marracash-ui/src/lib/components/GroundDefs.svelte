<script lang="ts">
    import { PackedEarthPatternId, StreetDustPatternId } from '$lib/utils/ground.js'
    import { BoardTextures } from '$lib/utils/boardTextures.js'
    import PackedEarthTexture from '$lib/textures/packed-earth.webp'
    import StreetDustTexture from '$lib/textures/street-dust.webp'

    const earth = BoardTextures.packedEarth
    const dust = BoardTextures.streetDust
</script>

<pattern
    id={PackedEarthPatternId}
    width={earth.size}
    height={earth.size}
    patternUnits="userSpaceOnUse"
>
    <rect width={earth.size} height={earth.size} fill={earth.base}></rect>
    <image href={PackedEarthTexture} width={earth.size} height={earth.size}></image>
</pattern>
<pattern
    id={StreetDustPatternId}
    width={dust.size}
    height={dust.size}
    patternUnits="userSpaceOnUse"
>
    <image href={StreetDustTexture} width={dust.size} height={dust.size}></image>
</pattern>
