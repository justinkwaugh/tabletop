<script lang="ts">
    import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BAR_HALF_THICKNESS, type HeldApproach } from '$lib/utils/pieceLayout.js'

    let { approaches }: { approaches: readonly HeldApproach[] } = $props()

    const gameSession = getGameSession()
</script>

{#each approaches as held (held.approach)}
    {@const bar = APPROACH_GEOMETRY[held.approach]}
    <rect
        transform="translate({bar.centre.x + (bar.inward.x * BAR_HALF_THICKNESS) / 2} {bar.centre
            .y +
            (bar.inward.y * BAR_HALF_THICKNESS) / 2}) rotate({bar.angle})"
        x={-bar.length / 2}
        y={-BAR_HALF_THICKNESS / 2}
        width={bar.length}
        height={BAR_HALF_THICKNESS}
        fill={gameSession.armyColors(held.playerId).block}
        class="pointer-events-none"
    ></rect>
{/each}
