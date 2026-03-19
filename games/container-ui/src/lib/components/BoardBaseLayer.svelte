<script lang="ts">
    import islandImg from '$lib/images/island.webp'
    import offshoreImg from '$lib/images/offshore@2x.webp'

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
    {#if offshoreRect}
        <image
            href={offshoreImg}
            x={offshoreRect.x}
            y={offshoreRect.y}
            width={offshoreRect.width}
            height={offshoreRect.height}
            preserveAspectRatio="xMidYMid meet"
        ></image>
    {/if}
</g>
