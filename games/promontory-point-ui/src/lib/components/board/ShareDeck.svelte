<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import type { RailroadId } from '@tabletop/promontory-point'
    import { shareFaceImage } from '$lib/images/cardImages.js'

    let {
        railroadId,
        count,
        price,
        box
    }: { railroadId: RailroadId; count: number; price: number; box: BoundingBox } = $props()

    const priceText = $derived(`$${price}`)
    const coupon = $derived({ x: -16, y: -26, width: 64 + priceText.length * 22, height: 72 })
    const countText = $derived(String(count))
    const badgeWidth = $derived(Math.max(86, 40 + countText.length * 30))
    const badge = $derived({
        width: badgeWidth,
        height: 82,
        x: box.width + 16 - badgeWidth,
        y: box.height - 56
    })
</script>

<!-- R-1.3: a share deck lies face up with its price and count; an empty deck leaves its outline. -->
<g
    transform="translate({box.x} {box.y})"
    data-share-deck={railroadId}
    data-count={count}
    data-price={price}
>
    {#if count > 0}
        {#if count > 1}
            <rect
                x="16"
                y="16"
                width={box.width}
                height={box.height}
                rx="14"
                fill="var(--pp-charcoal)"
                opacity="0.25"
            ></rect>
        {/if}
        <rect
            x="8"
            y="8"
            width={box.width}
            height={box.height}
            rx="14"
            fill="var(--pp-charcoal)"
            opacity="0.45"
        ></rect>
        <image href={shareFaceImage(railroadId).src} width={box.width} height={box.height}></image>
    {:else}
        <rect
            width={box.width}
            height={box.height}
            rx="14"
            fill="none"
            stroke="var(--pp-brown)"
            stroke-width="6"
            stroke-dasharray="18 12"
        ></rect>
    {/if}
    <g data-deck-price>
        <rect
            x={coupon.x}
            y={coupon.y}
            width={coupon.width}
            height={coupon.height}
            rx={coupon.height / 2}
            fill="var(--pp-paper-deep)"
            stroke="var(--pp-brown)"
            stroke-width="6"
            stroke-dasharray="14 8"
        ></rect>
        <text
            x={coupon.x + coupon.width / 2}
            y={coupon.y + coupon.height / 2}
            class="pp-board-figure"
            font-size="46"
            fill="var(--pp-ink)">{priceText}</text
        >
    </g>
    <g data-deck-count>
        <rect
            x={badge.x}
            y={badge.y}
            width={badge.width}
            height={badge.height}
            rx="14"
            fill="var(--pp-charcoal)"
            stroke="var(--pp-paper)"
            stroke-width="6"
        ></rect>
        <text
            x={badge.x + badge.width / 2}
            y={badge.y + badge.height / 2}
            class="pp-board-figure"
            font-size="56"
            fill="var(--pp-paper)">{countText}</text
        >
    </g>
</g>
