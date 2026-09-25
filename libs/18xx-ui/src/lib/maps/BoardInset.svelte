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
    style:left={`${area.x + (area.width - width * scale) / 2}px`}
    style:top={`${area.y + (area.height - height * scale) / 2}px`}
    style:transform={`scale(${scale})`}
>
    {@render children()}
</div>

<style>
    .board-inset {
        position: absolute;
        width: max-content;
        transform-origin: 0 0;
    }
</style>
