<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { BoundingBox } from '@tabletop/common'

    let { box, caption, children }: { box: BoundingBox; caption: string; children: Snippet } =
        $props()
</script>

<g transform="translate({box.x} {box.y})" role="group" aria-label={caption}>
    <rect
        width={box.width}
        height={box.height}
        rx="12"
        fill="var(--rtr-panel)"
        stroke="var(--rtr-card-edge)"
        stroke-width="2"
    ></rect>
    <text x="16" y="27" class="caption" fill="var(--rtr-ink-muted)">{caption.toUpperCase()}</text>
    {@render children()}
</g>

<style>
    .caption {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 1.2px;
    }
</style>
