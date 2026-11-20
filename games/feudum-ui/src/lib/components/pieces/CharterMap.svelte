<script lang="ts">
    import { Spaces, type SpaceId } from '@tabletop/feudum'
    import { MapArea, MapViewBox, SpaceCentres } from '$lib/utils/boardGeometry.js'

    /** R-4.4.3 The Kingdom charter's map: the board's spaces, its qualifying ones dotted. */
    let {
        spaces,
        width,
        x = 0,
        y = 0
    }: { spaces: readonly SpaceId[]; width: number; x?: number; y?: number } = $props()
</script>

<svg
    {x}
    {y}
    {width}
    height={(width * MapArea.height) / MapArea.width}
    viewBox={MapViewBox}
    role="img"
    aria-label="Map of this charter's qualifying spaces"
    data-charter-map
>
    <rect
        x={MapArea.x}
        y={MapArea.y}
        width={MapArea.width}
        height={MapArea.height}
        fill="var(--feudum-parchment-shade)"
    ></rect>
    {#each Spaces as { id } (id)}
        {@const dotted = spaces.includes(id)}
        <circle
            cx={SpaceCentres[id].x}
            cy={SpaceCentres[id].y}
            r="38"
            fill={dotted ? 'var(--feudum-ink)' : 'none'}
            stroke="var(--feudum-ink)"
            stroke-width="8"
            data-qualifying={dotted ? id : undefined}
        ></circle>
    {/each}
</svg>
