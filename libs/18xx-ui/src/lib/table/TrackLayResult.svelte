<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { RailwayMap, TileSet, TrackLayDetails } from '@tabletop/18xx'
    import Tile from '../tiles/Tile.svelte'

    let {
        details,
        map,
        tileSet
    }: {
        details: TrackLayDetails
        map: RailwayMap
        tileSet: TileSet
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
    const upgraded = $derived(!!previous || previousFace.color !== 'white')
</script>

<div class="track-result" aria-label="Recorded track lay">
    <span>{upgraded ? 'Upgraded' : 'Laid'}</span>
    {#if upgraded}
        <Tile
            face={previousFace}
            printedNumber={previous?.printedNumber}
            rotation={details.previous?.rotation ?? 0}
            orientation={map.definition.orientation}
            size={64}
        />
        <span aria-label="to">→</span>
    {/if}
    <Tile
        face={placed.face}
        printedNumber={placed.printedNumber}
        rotation={details.rotation}
        orientation={map.definition.orientation}
        size={64}
    />
    {#if details.cost > 0}
        <span>for ${details.cost.toLocaleString('en-US')}</span>
    {/if}
</div>

<style>
    .track-result {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
    }
</style>
