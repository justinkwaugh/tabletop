<script lang="ts">
    import islandImg from '$lib/images/island.webp'
    import {
        BOARD_HEIGHT,
        BOARD_WIDTH,
        ISLAND_IMAGE_HEIGHT,
        ISLAND_IMAGE_WIDTH,
        ISLAND_IMAGE_X,
        ISLAND_IMAGE_Y
    } from '$lib/definitions/boardLayout.js'
</script>

<g aria-hidden="true">
    <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} rx="36" fill="#444a78"></rect>
    <image
        href={islandImg}
        x={ISLAND_IMAGE_X}
        y={ISLAND_IMAGE_Y}
        width={ISLAND_IMAGE_WIDTH}
        height={ISLAND_IMAGE_HEIGHT}
        preserveAspectRatio="xMidYMid meet"
    ></image>
</g>
