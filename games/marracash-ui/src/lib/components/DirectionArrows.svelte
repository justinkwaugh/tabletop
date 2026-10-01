<script lang="ts">
    import { CardinalDirection, cellNeighborCoords } from '@tabletop/common'
    import { getFountain, type Route } from '@tabletop/marracash'
    import { cellCenter } from '$lib/utils/boardGeometry.js'

    let {
        routes,
        onpreview,
        onchoose
    }: {
        routes: readonly Route[]
        onpreview: (route: Route | undefined) => void
        onchoose: (direction: CardinalDirection) => void
    } = $props()

    const Rotation: Record<CardinalDirection, number> = {
        [CardinalDirection.North]: 0,
        [CardinalDirection.East]: 90,
        [CardinalDirection.South]: 180,
        [CardinalDirection.West]: 270
    }

    let arrows = $derived(
        routes.map((route) => ({
            route,
            center: cellCenter(cellNeighborCoords(getFountain(route.from).coords, route.direction))
        }))
    )
</script>

{#each arrows as arrow (arrow.route.direction)}
    <g
        role="button"
        tabindex="0"
        aria-label="Move visitors {arrow.route.direction} to fountain {arrow.route.to}"
        class="cursor-pointer"
        transform="translate({arrow.center.x} {arrow.center.y}) rotate({Rotation[
            arrow.route.direction
        ]})"
        onpointerenter={() => onpreview(arrow.route)}
        onpointerleave={() => onpreview(undefined)}
        onfocus={() => onpreview(arrow.route)}
        onblur={() => onpreview(undefined)}
        onclick={() => onchoose(arrow.route.direction)}
        onkeydown={(event) => event.key === 'Enter' && onchoose(arrow.route.direction)}
    >
        <circle r="24" fill="#1f1f1f" opacity="0.85" />
        <path d="M 0 -14 L 12 4 L 4 4 L 4 14 L -4 14 L -4 4 L -12 4 Z" fill="#ffffff" />
    </g>
{/each}
