<script lang="ts">
    import type { CoralColor } from '@tabletop/reef-encounter'
    import { PolypFaces } from '$lib/images/art.generated.js'
    import { BiteMask } from '$lib/utils/bite.js'

    let {
        color,
        count,
        consumed = false
    }: { color: CoralColor; count: number; consumed?: boolean } = $props()
</script>

<span class="chip" class:consumed title="{count} {color}">
    <img
        style:mask-image={consumed ? BiteMask : undefined}
        src={PolypFaces[color][0].url}
        alt="{count} {color} polyp{count === 1 ? '' : 's'}"
        width="22"
        height="22"
    />
    {#if count > 1}<span class="count reef-display" aria-hidden="true">{count}</span>{/if}
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

    /* The image's ring is cut away with the bite; this one follows the bite's edge. */
    .consumed {
        filter: drop-shadow(0 0 0.6px rgb(0 0 0 / 0.8));
    }

    .consumed img {
        mask-composite: intersect;
    }

    .count {
        font-size: 14px;
        font-variant-numeric: tabular-nums;
    }
</style>
