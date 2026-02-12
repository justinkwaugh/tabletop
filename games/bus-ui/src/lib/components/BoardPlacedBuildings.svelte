<script lang="ts">
    import { isSiteId, type Building, type BuildingSiteId } from '@tabletop/bus'
    import PlacedBuilding from './PlacedBuilding.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const placedBuildings: (Building & { site: BuildingSiteId })[] = $derived.by(() => {
        return Object.values(gameSession.gameState.board.buildings).filter((building) =>
            isSiteId(building.site)
        ) as (Building & { site: BuildingSiteId })[]
    })
</script>

{#each placedBuildings as building (building.id)}
    <PlacedBuilding siteId={building.site} buildingType={building.type} />
{/each}
