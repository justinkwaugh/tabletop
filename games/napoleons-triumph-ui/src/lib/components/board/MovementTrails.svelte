<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { numberOfTrail } from '$lib/utils/trailNumber.js'
    import WayArrow from './WayArrow.svelte'

    const gameSession = getGameSession()
    const view = $derived(gameSession.flagView)

    // Deliberate: the arrows let the map show through a little, so a turn's worth of them does not bury it; their numbers stay solid to be read.
    const TRAIL_OPACITY = 0.65
</script>

<g pointer-events="none" data-movement-trails>
    <g opacity={TRAIL_OPACITY}>
        {#each gameSession.movementTrails as trail, index (index)}
            <WayArrow arrow={trail.arrow} color={gameSession.armyColors(trail.playerId).block} />
        {/each}
    </g>
    {#each gameSession.movementTrails as trail, index (index)}
        {@const number = numberOfTrail(trail, view.scale)}
        <text
            class="nt-trail-number"
            x={number.at.x}
            y={number.at.y}
            font-size={number.size}
            stroke-width={number.size * 0.2}
            fill={gameSession.armyColors(trail.playerId).block}
            transform="rotate({-view.rotation} {number.at.x} {number.at.y})">{trail.order}</text
        >
    {/each}
</g>

<style>
    .nt-trail-number {
        stroke: #f1ecdc;
        stroke-linejoin: round;
        paint-order: stroke;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
    }
</style>
