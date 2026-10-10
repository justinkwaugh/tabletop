<script lang="ts">
    import type { CoralColor } from '@tabletop/reef-encounter'
    import { PolypFaceUrls } from '$lib/images/art.generated.js'

    let { color, count }: { color: CoralColor; count: number } = $props()
</script>

<span class="chip" title="{count} {color}">
    <img src={PolypFaceUrls[color][0]} alt="{color} polyp" width="22" height="22" />
    {#if count > 1}<span class="count reef-display">{count}</span>{/if}
</span>

<style>
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 2px;
    }

    img {
        border-radius: 3px;
        box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
    }

    .count {
        font-size: 14px;
        font-variant-numeric: tabular-nums;
    }
</style>
