<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { numberOfTrail } from '$lib/utils/trailNumber.js'
    import WayArrow from './WayArrow.svelte'

    const gameSession = getGameSession()
    const view = $derived(gameSession.flagView)
</script>

<g pointer-events="none" data-movement-trails>
    {#each gameSession.movementTrails as trail, index (index)}
        <WayArrow arrow={trail.arrow} />
    {/each}
    {#each gameSession.movementTrails as trail, index (index)}
        {@const number = numberOfTrail(trail, view.scale)}
        <text
            class="nt-trail-number"
            x={number.at.x}
            y={number.at.y}
            font-size={number.size}
            stroke-width={number.size * 0.2}
            transform="rotate({-view.rotation} {number.at.x} {number.at.y})">{trail.order}</text
        >
    {/each}
</g>

<style>
    .nt-trail-number {
        fill: #2b2620;
        stroke: #f1ecdc;
        stroke-linejoin: round;
        paint-order: stroke;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
    }
</style>
