<script lang="ts">
    import Battlements from '$lib/components/Battlements.svelte'
    import { BoardHeight, BoardWidth } from '$lib/utils/boardGeometry.js'
    import {
        MerlonColor,
        RammedEarthPatternId,
        WallBattlements,
        WallWalkway
    } from '$lib/utils/cityWall.js'

    const EarthTileSize = 180
    const Earths = [
        { id: RammedEarthPatternId, base: WallWalkway, seed: 4 },
        { id: `${RammedEarthPatternId}-raised`, base: MerlonColor, seed: 9 }
    ]
</script>

<defs>
    {#each Earths as earth (earth.id)}
        <filter
            id="{earth.id}-grain"
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={EarthTileSize}
            height={EarthTileSize}
        >
            <feTurbulence
                type="fractalNoise"
                baseFrequency="0.035 0.11"
                numOctaves="4"
                seed={earth.seed}
                stitchTiles="stitch"
            ></feTurbulence>
            <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.36  0 0 0 0 0.16  0 0 0 0 0.08  1.1 0 0 0 -0.42"
            ></feColorMatrix>
        </filter>
        <pattern
            id={earth.id}
            width={EarthTileSize}
            height={EarthTileSize}
            patternUnits="userSpaceOnUse"
        >
            <rect width={EarthTileSize} height={EarthTileSize} fill={earth.base}></rect>
            <rect width={EarthTileSize} height={EarthTileSize} filter="url(#{earth.id}-grain)"
            ></rect>
        </pattern>
    {/each}
</defs>

<rect width={BoardWidth} height={BoardHeight} fill="url(#{RammedEarthPatternId})"></rect>
<Battlements paths={WallBattlements} />
