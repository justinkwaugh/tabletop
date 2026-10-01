<script lang="ts">
    import { getFountain, type FountainState } from '@tabletop/marracash'
    import Pawn from '$lib/components/Pawn.svelte'
    import { cellCenter, clusterPositions } from '$lib/utils/boardGeometry.js'

    let { fountain }: { fountain: FountainState } = $props()

    let definition = $derived(getFountain(fountain.fountainId))
    let center = $derived(cellCenter(definition.coords))
    let pawnSize = $derived(fountain.visitors.length > 9 ? 13 : 18)
    let pawns = $derived(
        clusterPositions(fountain.visitors.length, center, pawnSize + 3).map((position, index) => ({
            ...position,
            color: fountain.visitors[index]
        }))
    )
</script>

<g>
    <circle
        cx={center.x}
        cy={center.y}
        r="34"
        fill="#9fd3e6"
        stroke={definition.entrance ? '#c99a2e' : '#5b8fa3'}
        stroke-width={definition.entrance ? 6 : 3}
    />
    <circle cx={center.x} cy={center.y} r="26" fill="#cfeaf3" opacity="0.7" />
    <text
        x={center.x - 30}
        y={center.y - 22}
        font-size="12"
        font-weight="700"
        fill="#2d5566">{fountain.fountainId}</text
    >
    {#each pawns as pawn, index (index)}
        <Pawn color={pawn.color} x={pawn.x} y={pawn.y} size={pawnSize} />
    {/each}
</g>
