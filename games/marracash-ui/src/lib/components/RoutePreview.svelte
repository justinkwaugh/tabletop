<script lang="ts">
    import { getFountain, type Route } from '@tabletop/marracash'
    import { cellCenter } from '$lib/utils/boardGeometry.js'

    let { route }: { route: Route } = $props()

    let points = $derived(
        [getFountain(route.from).coords, ...route.path]
            .map((coords) => cellCenter(coords))
            .map((point) => `${point.x},${point.y}`)
            .join(' ')
    )
    let destination = $derived(cellCenter(getFountain(route.to).coords))
</script>

<g pointer-events="none">
    <polyline
        {points}
        fill="none"
        stroke="#1f1f1f"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.55"
    ></polyline>
    <polyline
        {points}
        fill="none"
        stroke="#ffffff"
        stroke-width="3"
        stroke-dasharray="10 8"
        stroke-linecap="round"
        stroke-linejoin="round"
    ></polyline>
    <circle
        cx={destination.x}
        cy={destination.y}
        r="42"
        fill="none"
        stroke="#ffffff"
        stroke-width="4"
    ></circle>
</g>
