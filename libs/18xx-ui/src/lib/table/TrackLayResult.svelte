<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { RailwayMap, TileSet, TrackLayDetails } from '@tabletop/18xx'
    import Tile from '../tiles/Tile.svelte'
    import type { TileAppearance } from '../tiles/tileAppearance.js'
    import type { TileLayout } from '../tiles/tileDrawing.js'
    import { placedTileLayout } from '../tiles/standardTileLayouts.js'

    let {
        details,
        map,
        tileSet,
        layouts,
        appearance,
        size = 64
    }: {
        details: TrackLayDetails
        map: RailwayMap
        tileSet: TileSet
        layouts: Readonly<Record<string, TileLayout>> | undefined
        appearance?: TileAppearance
        size?: number
    } = $props()
    function definition(id: string) {
        const tile = tileSet.definitions.find((tile) => tile.id === id)
        assertExists(tile, 'Recorded track lay requires its tile definition')
        return tile
    }
    const placed = $derived(definition(details.definitionId))
    const previous = $derived(
        details.previous ? definition(details.previous.definitionId) : undefined
    )
    const previousFace = $derived(previous?.face ?? map.location(details.locationId).preprintedTile)
    const previousLayout = $derived(
        previous ? placedTileLayout(layouts, previous.id) : layouts?.[details.locationId]
    )
    const upgraded = $derived(!!previous || previousFace.color !== 'white')
</script>

<div class="track-result" aria-label="Recorded track lay">
    {#if upgraded}
        <Tile
            face={previousFace}
            printedNumber={previous?.printedNumber}
            rotation={details.previous?.rotation ?? 0}
            orientation={map.definition.orientation}
            layout={previousLayout}
            {appearance}
            {size}
        />
        <span aria-label="to">→</span>
    {/if}
    <Tile
        face={placed.face}
        printedNumber={placed.printedNumber}
        rotation={details.rotation}
        orientation={map.definition.orientation}
        layout={placedTileLayout(layouts, placed.id)}
        {appearance}
        {size}
    />
</div>

<style>
    .track-result {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        flex-wrap: wrap;
    }
</style>
