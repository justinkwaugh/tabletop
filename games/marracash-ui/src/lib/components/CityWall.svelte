<script lang="ts">
    import Battlements from '$lib/components/Battlements.svelte'
    import { BoardHeight, BoardWidth } from '$lib/utils/boardGeometry.js'
    import { RammedEarthPatternId, WallBattlements } from '$lib/utils/cityWall.js'
    import { BoardTextures } from '$lib/utils/boardTextures.js'
    import RammedEarthTexture from '$lib/textures/rammed-earth.webp'
    import RammedEarthRaisedTexture from '$lib/textures/rammed-earth-raised.webp'

    const Earths = [
        { id: RammedEarthPatternId, spec: BoardTextures.rammedEarth, image: RammedEarthTexture },
        {
            id: `${RammedEarthPatternId}-raised`,
            spec: BoardTextures.rammedEarthRaised,
            image: RammedEarthRaisedTexture
        }
    ]
</script>

<defs>
    {#each Earths as earth (earth.id)}
        <pattern
            id={earth.id}
            width={earth.spec.size}
            height={earth.spec.size}
            patternUnits="userSpaceOnUse"
        >
            <rect width={earth.spec.size} height={earth.spec.size} fill={earth.spec.base}></rect>
            <image href={earth.image} width={earth.spec.size} height={earth.spec.size}></image>
        </pattern>
    {/each}
</defs>

<rect width={BoardWidth} height={BoardHeight} fill="url(#{RammedEarthPatternId})"></rect>
<Battlements paths={WallBattlements} />
