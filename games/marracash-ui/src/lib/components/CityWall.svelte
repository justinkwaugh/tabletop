<script lang="ts">
    import { BoardHeight, BoardWidth } from '$lib/utils/boardGeometry.js'
    import {
        MerlonColor,
        RammedEarthPatternId,
        WallMerlons,
        WallParapets,
        WallStoneFilterId,
        WallWalkway
    } from '$lib/utils/cityWall.js'

    const BevelMargin = 20
    const EarthTileSize = 180
    const Earths = [
        { id: RammedEarthPatternId, base: WallWalkway, seed: 4 },
        { id: `${RammedEarthPatternId}-raised`, base: MerlonColor, seed: 9 }
    ]
</script>

<defs>
    <filter
        id={WallStoneFilterId}
        filterUnits="userSpaceOnUse"
        x={-BevelMargin}
        y={-BevelMargin}
        width={BoardWidth + 2 * BevelMargin}
        height={BoardHeight + 2 * BevelMargin}
    >
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="height"></feGaussianBlur>
        <feDiffuseLighting
            in="height"
            surfaceScale="2.4"
            diffuseConstant="1.1"
            lighting-color="#ffffff"
            result="light"
        >
            <feDistantLight azimuth="225" elevation="48"></feDistantLight>
        </feDiffuseLighting>
        <feComposite in="light" in2="SourceAlpha" operator="in" result="stoneLight"></feComposite>
        <feBlend in="SourceGraphic" in2="stoneLight" mode="multiply" result="lit"></feBlend>
        <feOffset in="SourceAlpha" dx="2" dy="2.5" result="dropped"></feOffset>
        <feGaussianBlur in="dropped" stdDeviation="1.2" result="blurred"></feGaussianBlur>
        <feFlood flood-color="#3b1a0b" flood-opacity="0.4"></feFlood>
        <feComposite in2="blurred" operator="in" result="shadow"></feComposite>
        <feMerge>
            <feMergeNode in="shadow"></feMergeNode>
            <feMergeNode in="lit"></feMergeNode>
        </feMerge>
    </filter>
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
<g filter="url(#{WallStoneFilterId})" fill="url(#{RammedEarthPatternId}-raised)">
    {#each WallParapets as parapet (`${parapet.x},${parapet.y}`)}
        <rect x={parapet.x} y={parapet.y} width={parapet.width} height={parapet.height}></rect>
    {/each}
    {#each WallMerlons as merlon (`${merlon.x},${merlon.y}`)}
        <rect x={merlon.x} y={merlon.y} width={merlon.width} height={merlon.height} rx="1"></rect>
    {/each}
</g>
