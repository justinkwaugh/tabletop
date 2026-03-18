<script lang="ts">
    import islandImg from '$lib/images/island.webp'

    let {
        boardWidth,
        boardHeight,
        boardCornerRadius,
        islandRect
    }: {
        boardWidth: number
        boardHeight: number
        boardCornerRadius: number
        islandRect: { x: number; y: number; width: number; height: number }
    } = $props()
</script>

<g aria-hidden="true">
    <rect
        x="0"
        y="0"
        width={boardWidth}
        height={boardHeight}
        rx={boardCornerRadius}
        fill="#444a78"
    ></rect>
    <image
        href={islandImg}
        x={islandRect.x}
        y={islandRect.y}
        width={islandRect.width}
        height={islandRect.height}
        preserveAspectRatio="xMidYMid meet"
    ></image>
</g>
