<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import type { Snippet } from 'svelte'
    let { area, label, children }: { area: BoundingBox; label: string; children: Snippet } =
        $props()
    let width = $state(0)
    let height = $state(0)
    const scale = $derived(width && height ? Math.min(area.width / width, area.height / height) : 0)
</script>

<div
    class="board-inset"
    role="region"
    aria-label={label}
    bind:offsetWidth={width}
    bind:offsetHeight={height}
    style:left={`calc(${area.x + (area.width - width * scale) / 2}px * var(--render-zoom, 1))`}
    style:top={`calc(${area.y}px * var(--render-zoom, 1))`}
    style:transform={`scale(calc(${scale} * var(--render-zoom, 1)))`}
>
    {@render children()}
</div>

<style>
    /* An inset's box can overlap hexes in its empty corners, so only its drawn content opts back in to pointers. */
    .board-inset {
        /* HTML under a view-scale board's CSS zoom moves and hits Safari 27.0's 9px floor, so take the zoom off and scale by transform. */
        zoom: var(--render-unzoom, 1);
        pointer-events: none;
        position: absolute;
        width: max-content;
        transform-origin: 0 0;
    }
</style>
