<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { BoundingBox } from '@tabletop/common'

    let { box, title, children }: { box: BoundingBox; title: string; children?: Snippet } = $props()
</script>

<!-- O-8: one of the strip's paper cards, its caps heading in the decade markers' brown. -->
<g transform="translate({box.x} {box.y})">
    <rect y="8" width={box.width} height={box.height} rx="16" fill="var(--pp-halo)" opacity="0.35"
    ></rect>
    <rect
        width={box.width}
        height={box.height}
        rx="16"
        fill="var(--pp-paper)"
        stroke="var(--pp-brown)"
        stroke-opacity="0.6"
        stroke-width="6"
        stroke-dasharray="18 12"
    ></rect>
    <text
        x={box.width / 2}
        y="62"
        class="pp-board-figure pp-strip-heading"
        font-size="46"
        fill="var(--pp-brown)">{title}</text
    >
</g>
{#if children}
    <g transform="translate({box.x} {box.y})">
        {@render children()}
    </g>
{/if}
