<script lang="ts">
    import { isSiteId, type Building, type BuildingSiteId, type BuildingType } from '@tabletop/bus'
    import {
        animatePlacedBuilding,
        BuildingPlacementAnimator
    } from '$lib/animators/buildingPlacementAnimator.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import { BUS_BUILDING_SITE_POINTS } from '$lib/definitions/busBoardGraph.js'
    import PlacedBuilding from './PlacedBuilding.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    let animatedAddedBuildings: {
        siteId: BuildingSiteId
        buildingType: BuildingType
    }[] = $derived.by(() => {
        gameSession.gameState
        return []
    })

    const buildingPlacementAnimator = new BuildingPlacementAnimator(gameSession, {
        onPlacementStart: ({ siteId, buildingType }) => {
            animatedAddedBuildings = [...animatedAddedBuildings, { siteId, buildingType }]
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
    {#if !animatedAddedBuildings.some((animatedBuilding) => animatedBuilding.siteId === building.site)}
        {@const point = BUS_BUILDING_SITE_POINTS[building.site]}
        <g
            transform={`translate(${point.x} ${point.y})`}
            use:animatePlacedBuilding={{ animator: buildingPlacementAnimator, siteId: building.site }}
        >
            <PlacedBuilding buildingType={building.type} />
        </g>
    {/if}
{/each}

{#each animatedAddedBuildings as animatedBuilding (`animated:${animatedBuilding.siteId}`)}
    {@const point = BUS_BUILDING_SITE_POINTS[animatedBuilding.siteId]}
    <g
        transform={`translate(${point.x} ${point.y})`}
        use:animatePlacedBuilding={{
            animator: buildingPlacementAnimator,
            siteId: animatedBuilding.siteId
        }}
    >
        <PlacedBuilding buildingType={animatedBuilding.buildingType} />
    </g>
{/each}
