<script lang="ts">
    import { isSiteId, type Building, type BuildingSiteId, type BuildingType } from '@tabletop/bus'
    import { BuildingPlacementAnimator } from '$lib/animators/buildingPlacementAnimator.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import PlacedBuilding from './PlacedBuilding.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    let animatedBuilding:
        | {
              siteId: BuildingSiteId
              buildingType: BuildingType
              scale: number
          }
        | undefined = $state()

    const buildingPlacementAnimator = new BuildingPlacementAnimator(gameSession, {
        onStart: ({ siteId, buildingType, scale }) => {
            animatedBuilding = { siteId, buildingType, scale }
        },
        onUpdate: (scale) => {
            if (!animatedBuilding) {
                return
            }
            animatedBuilding = { ...animatedBuilding, scale }
        },
        onComplete: () => {
            animatedBuilding = undefined
        }
    })

    const placedBuildings: (Building & { site: BuildingSiteId })[] = $derived.by(() => {
        return Object.values(gameSession.gameState.board.buildings).filter((building) =>
            isSiteId(building.site)
        ) as (Building & { site: BuildingSiteId })[]
    })
</script>

<g class="pointer-events-none" {@attach attachAnimator(buildingPlacementAnimator)}></g>

{#each placedBuildings as building (building.id)}
    <PlacedBuilding siteId={building.site} buildingType={building.type} />
{/each}

{#if animatedBuilding}
    <PlacedBuilding
        siteId={animatedBuilding.siteId}
        buildingType={animatedBuilding.buildingType}
        scale={animatedBuilding.scale}
    />
{/if}
