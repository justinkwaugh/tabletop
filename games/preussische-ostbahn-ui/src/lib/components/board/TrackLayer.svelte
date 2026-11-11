<script lang="ts">
    import { BERLIN, SpaceKind, mapSpace, occupants } from '@tabletop/preussische-ostbahn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cubeSlots } from '$lib/utils/cubeLayout.js'
    import { spaceCenterById } from '$lib/utils/boardGeometry.js'
    import Cube from './Cube.svelte'

    const gameSession = getGameSession()

    const occupied = $derived(
        [...new Set(gameSession.gameState.railroads.flatMap((railroad) => railroad.track))].map(
            (spaceId) => ({
                spaceId,
                railroads: occupants(gameSession.gameState.railroads, spaceId)
            })
        )
    )
</script>

<g class="track" pointer-events="none">
    {#each occupied as { spaceId, railroads } (spaceId)}
        {@const center = spaceCenterById(spaceId)}
        {@const city = mapSpace(spaceId).kind === SpaceKind.City}
        {#each cubeSlots(center, railroads.length, city, spaceId === BERLIN) as slot, index (railroads[index])}
            <Cube railroadId={railroads[index]} x={slot.x} y={slot.y} size={slot.size} />
        {/each}
    {/each}
</g>
