<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HEX } from '$lib/utils/boardGeometry.js'
    import { localHexPoints, pointsAttribute, spaceCentre } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()
    const outline = pointsAttribute(localHexPoints(0.93))
    const badge = { x: HEX.xRadius * 0.66, y: -HEX.yRadius * 0.57, radius: 30 }

    const placements = $derived(
        [...gameSession.boardOffer.hexes].flatMap(([spaceId, offer]) =>
            offer.placementOrder === undefined ? [] : [{ spaceId, order: offer.placementOrder }]
        )
    )
</script>

<!-- R-2.2 step 3: this turn's placements, dashed with their order, for every seat. -->
{#each placements as { spaceId, order } (spaceId)}
    {@const centre = spaceCentre(spaceId)}
    <g transform="translate({centre.x} {centre.y})" data-placement-order={order}>
        <polygon
            points={outline}
            fill="none"
            stroke="var(--pp-decided)"
            stroke-width="9"
            stroke-dasharray="22 14"
        ></polygon>
        <circle
            cx={badge.x}
            cy={badge.y}
            r={badge.radius}
            fill="var(--pp-decided)"
            stroke="var(--pp-halo)"
            stroke-width="5"
        ></circle>
        <text x={badge.x} y={badge.y} class="pp-board-figure" font-size="36" fill="var(--pp-halo)"
            >{order}</text
        >
    </g>
{/each}
