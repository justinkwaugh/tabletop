<script lang="ts">
    import { BoardHeight, BoardWidth } from '$lib/utils/boardGeometry.js'
    import { WallMortar, WallStoneFilterId, WallStones } from '$lib/utils/cityWall.js'

    const BevelMargin = 20
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
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="height"></feGaussianBlur>
        <feDiffuseLighting
            in="height"
            surfaceScale="2.2"
            diffuseConstant="1.05"
            lighting-color="#ffffff"
            result="light"
        >
            <feDistantLight azimuth="225" elevation="50"></feDistantLight>
        </feDiffuseLighting>
        <feComposite in="light" in2="SourceAlpha" operator="in" result="stoneLight"></feComposite>
        <feBlend in="SourceGraphic" in2="stoneLight" mode="multiply"></feBlend>
    </filter>
</defs>

<rect width={BoardWidth} height={BoardHeight} fill={WallMortar}></rect>
<g filter="url(#{WallStoneFilterId})">
    {#each WallStones as stone, index (index)}
        <rect
            x={stone.x}
            y={stone.y}
            width={stone.width}
            height={stone.height}
            rx="1.5"
            fill={stone.fill}
        ></rect>
    {/each}
</g>
