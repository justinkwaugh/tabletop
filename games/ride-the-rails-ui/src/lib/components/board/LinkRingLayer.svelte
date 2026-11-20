<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { pointText } from '$lib/utils/boardGeometry.js'
    import { LINK_RING, linkRings } from '$lib/utils/linkBonus.js'

    const gameSession = getGameSession()

    const rings = $derived(
        linkRings(gameSession.gameState.mapId, gameSession.gameState.connectionClaim).map(
            (ring) => ({ cityId: ring.cityId, points: ring.loop.map(pointText).join(' ') })
        )
    )
</script>

<!-- R-8: until the map's connection bonus is claimed, each of its link cities wears a gold ring
     just outside its hex (round both of Berlin's cells), under the city's marks and cubes. -->
<g class="link-rings" aria-hidden="true">
    {#each rings as ring (ring.cityId)}
        <polygon
            points={ring.points}
            fill="none"
            stroke="var(--rtr-gold)"
            stroke-width={LINK_RING.width}
            stroke-linejoin="round"
            data-link-ring={ring.cityId}
        ></polygon>
    {/each}
</g>
