<script lang="ts">
    import { HexOrientation } from '@tabletop/common'
    import type { TileDefinition, TileInventoryCount } from '@tabletop/18xx'
    import Tile from './Tile.svelte'
    import { ClassicTileAppearance, type TileAppearance } from './tileAppearance.js'
    import { StandardTileLayouts } from './standardTileLayouts.js'
    import type { TileLayout } from './tileDrawing.js'
    import { compareTileSimplicity } from './tilePresentation.js'

    let {
        tiles,
        inventory,
        layouts = {},
        orientation = HexOrientation.Flat,
        appearance = ClassicTileAppearance
    }: {
        tiles: readonly TileDefinition[]
        inventory: readonly TileInventoryCount[]
        layouts?: Readonly<Record<string, TileLayout>>
        orientation?: HexOrientation
        appearance?: TileAppearance
    } = $props()
    let color = $state('')
    const colors = $derived([...new Set(tiles.map((tile) => tile.face.color))])
    const remaining = $derived(
        new Map(inventory.map((entry) => [entry.definitionId, entry.available]))
    )
    const visible = $derived(
        tiles
            .filter(
                (tile) => (remaining.get(tile.id) ?? 0) > 0 && (!color || tile.face.color === color)
            )
            .sort(
                (a, b) =>
                    colors.indexOf(a.face.color) - colors.indexOf(b.face.color) ||
                    compareTileSimplicity(a, b)
            )
    )
</script>

<section class="manifest" aria-label="Tile manifest">
    <div class="filters" role="group" aria-label="Tile colors">
        {#each ['', ...colors] as value}
            <button
                aria-pressed={color === value}
                style:background={value ? appearance.colors[value] : '#faf7f1'}
                onclick={() => (color = value)}>{value || 'All'}</button
            >
        {/each}
    </div>
    <div class="tiles" role="list" aria-label="Remaining tiles">
        {#each visible as tile (tile.id)}
            <div
                class="tile"
                role="listitem"
                data-manifest-tile={tile.id}
                data-tile-color={tile.face.color}
            >
                <Tile
                    face={tile.face}
                    printedNumber={tile.printedNumber}
                    {orientation}
                    {appearance}
                    layout={layouts[tile.id] ?? StandardTileLayouts[tile.id]}
                    size={112}
                />
                <span class="count" aria-label={`${remaining.get(tile.id)} remaining`}>
                    ×{remaining.get(tile.id)}
                </span>
            </div>
        {/each}
    </div>
    {#if !visible.length}<p>No tiles remaining.</p>{/if}
</section>

<style>
    .manifest {
        padding: 16px;
    }
    .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
    }
    button {
        border: 1px solid #443c3433;
        border-radius: 999px;
        padding: 5px 15px;
        color: #24211d;
        font: inherit;
        font-size: 12px;
        text-transform: capitalize;
        cursor: pointer;
    }
    button[aria-pressed='true'] {
        outline: 2px solid #695540;
        outline-offset: 2px;
    }
    button:focus-visible {
        outline: 2px solid #695540;
        outline-offset: 3px;
    }
    .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, 112px);
        gap: 16px 20px;
    }
    .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .count {
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
    p {
        font-size: 13px;
        color: #8b7b6b;
    }
</style>
