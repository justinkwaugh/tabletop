<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { supplyKey } from '$lib/animators/flights.svelte.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let { railroadId, supply }: { railroadId: RailroadId; supply: number } = $props()

    const fill = $derived(railroadStyle(railroadId).fill)
</script>

<!-- A railroad card's supply (R-1.1): one cube in its colour and the locomotives left; a dashed
     cube once none is left. What a share or placement flight lifts from. A parent may shrink it
     through --supply-cube, --supply-gap and --supply-figure. -->
<span class="supply" class:empty={supply === 0} data-flight-target={supplyKey(railroadId)}>
    <span class="cube" style:--cube-fill={fill} aria-hidden="true"></span>
    <span class="rtr-display figure" aria-hidden="true">{supply}</span>
</span>

<style>
    .supply {
        display: flex;
        align-items: center;
        gap: var(--supply-gap, 6px);
    }

    .cube {
        width: var(--supply-cube, 16px);
        height: var(--supply-cube, 16px);
        border-radius: 3px;
        background: var(--cube-fill);
        border: 1.5px solid var(--rtr-cube-edge);
    }

    .empty .cube {
        background: none;
        border: 2px dashed var(--cube-fill);
        opacity: 0.6;
    }

    .figure {
        font-size: var(--supply-figure, 21px);
        line-height: 1;
    }

    .empty .figure {
        color: var(--rtr-ink-muted);
    }
</style>
