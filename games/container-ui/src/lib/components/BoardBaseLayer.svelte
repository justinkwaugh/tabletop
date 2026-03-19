<script lang="ts">
    import islandImg from '$lib/images/island.webp'
    import offshoreImg from '$lib/images/offshore@2x.webp'
    import {
        MAIN_ISLAND_BOUNDARY_PATH,
        OFFSHORE_ISLAND_BOUNDARY_PATH,
        OFFSHORE_ISLAND_SOURCE_HEIGHT,
        OFFSHORE_ISLAND_SOURCE_WIDTH,
        MAIN_ISLAND_SOURCE_HEIGHT,
        MAIN_ISLAND_SOURCE_WIDTH
    } from '$lib/definitions/islandGeometry.js'

    let {
        boardWidth,
        boardHeight,
        boardCornerRadius,
        islandRect,
        offshoreRect
    }: {
        boardWidth: number
        boardHeight: number
        boardCornerRadius: number
        islandRect: { x: number; y: number; width: number; height: number }
        offshoreRect?: { x: number; y: number; width: number; height: number }
    } = $props()
</script>

<g aria-hidden="true">
    <rect x="0" y="0" width={boardWidth} height={boardHeight} rx={boardCornerRadius} fill="#444a78"
    ></rect>
    <image
        href={islandImg}
        x={islandRect.x}
        y={islandRect.y}
        width={islandRect.width}
        height={islandRect.height}
        preserveAspectRatio="xMidYMid meet"
    ></image>
    <g
        transform={`translate(${islandRect.x} ${islandRect.y}) scale(${islandRect.width / MAIN_ISLAND_SOURCE_WIDTH} ${islandRect.height / MAIN_ISLAND_SOURCE_HEIGHT})`}
    >
        <path
            d={MAIN_ISLAND_BOUNDARY_PATH}
            fill="none"
            stroke="#ff2a2a"
            stroke-width="4"
            stroke-linejoin="round"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
        ></path>
    </g>
    {#if offshoreRect}
        <image
            href={offshoreImg}
            x={offshoreRect.x}
            y={offshoreRect.y}
            width={offshoreRect.width}
            height={offshoreRect.height}
            preserveAspectRatio="xMidYMid meet"
        ></image>
        <g
            transform={`translate(${offshoreRect.x} ${offshoreRect.y}) scale(${offshoreRect.width / OFFSHORE_ISLAND_SOURCE_WIDTH} ${offshoreRect.height / OFFSHORE_ISLAND_SOURCE_HEIGHT})`}
        >
            <path
                d={OFFSHORE_ISLAND_BOUNDARY_PATH}
                fill="none"
                stroke="#ff2a2a"
                stroke-width="1.5"
                stroke-miterlimit="10"
            ></path>
        </g>
    {/if}
</g>
