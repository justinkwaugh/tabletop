<script lang="ts">
    import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
    import {
        ATTACK_ARROW_PATH,
        FEINT_ARROW_FOLD_PATH,
        FEINT_ARROW_PATH,
        attackMarkerAngle
    } from '$lib/utils/attackMarker.js'

    let {
        approach,
        scale,
        feint = false
    }: { approach: number; scale: number; feint?: boolean } = $props()

    const bar = $derived(APPROACH_GEOMETRY[approach])
</script>

<g
    transform="translate({bar.centre.x} {bar.centre.y}) scale({scale})"
    class="pointer-events-none"
    data-attack-arrow={feint ? 'feint' : 'attack'}
>
    <g transform="rotate({attackMarkerAngle(bar)})" stroke="#f1ecdc" stroke-width="2.5">
        {#if feint}
            <path d={FEINT_ARROW_FOLD_PATH} fill="#4c0b0e" stroke-linejoin="round"></path>
            <path d={FEINT_ARROW_PATH} fill="#7a1418" stroke-linejoin="round"></path>
        {:else}
            <path d={ATTACK_ARROW_PATH} fill="#7a1418" stroke-linejoin="round"></path>
        {/if}
    </g>
</g>
