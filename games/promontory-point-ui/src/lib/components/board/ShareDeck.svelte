<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import type { RailroadId } from '@tabletop/promontory-point'
    import { shareFaceImage } from '$lib/images/cardImages.js'

    let { railroadId, count, box }: { railroadId: RailroadId; count: number; box: BoundingBox } =
        $props()

    const badge = $derived({ width: 74, height: 52, x: box.width - 60, y: box.height - 40 })
</script>

<!-- R-1.3: a share deck lies face up with its count; an empty deck leaves its outline. -->
<g transform="translate({box.x} {box.y})" data-share-deck={railroadId} data-count={count}>
    {#if count > 0}
        <rect
            x="7"
            y="7"
            width={box.width}
            height={box.height}
            rx="9"
            fill="var(--pp-halo)"
            opacity="0.35"
        ></rect>
        <image href={shareFaceImage(railroadId).src} width={box.width} height={box.height}></image>
    {:else}
        <rect
            width={box.width}
            height={box.height}
            rx="9"
            fill="none"
            stroke="var(--pp-paper)"
            stroke-width="5"
            stroke-dasharray="16 12"
        ></rect>
    {/if}
    <rect
        x={badge.x}
        y={badge.y}
        width={badge.width}
        height={badge.height}
        rx="12"
        fill="var(--pp-halo)"
    ></rect>
    <text
        x={badge.x + badge.width / 2}
        y={badge.y + badge.height / 2}
        class="pp-board-figure"
        font-size="38"
        fill="var(--pp-text)">{count}</text
    >
</g>
