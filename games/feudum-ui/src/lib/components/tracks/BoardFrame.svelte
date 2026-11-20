<script lang="ts">
    import { ringPrint } from '$lib/art/assetMap.js'
    import { RingSource } from '$lib/art/ringPieces.js'
    import { BoardHeight, BoardWidth } from '$lib/utils/boardGeometry.js'

    let { printed = true }: { printed?: boolean } = $props()

    const label = "The board's edge"
    let parts = $derived(printed ? ringPrint() : undefined)

    const scale = Math.min(BoardWidth / RingSource.width, BoardHeight / RingSource.height)
    const left = (BoardWidth - RingSource.width * scale) / 2
    const top = (BoardHeight - RingSource.height * scale) / 2
</script>

<svg
    width={BoardWidth}
    height={BoardHeight}
    viewBox="0 0 {BoardWidth} {BoardHeight}"
    role="img"
    aria-label={label}
>
    <title>{label}</title>
    {#if parts}
        {#each parts as { part, url, draw: [x, y, width, height], file } (part)}
            <svg
                x={left + x * scale}
                y={top + y * scale}
                width={width * scale}
                height={height * scale}
                viewBox="{x} {y} {width} {height}"
                data-ring-piece={part}
            >
                <image href={url} x={file[0]} y={file[1]} width={file[2]} height={file[3]}></image>
            </svg>
        {/each}
    {:else}
        <rect width={BoardWidth} height={BoardHeight} fill="var(--feudum-board-frame)"></rect>
    {/if}
</svg>
