<script lang="ts">
    import { assertExists, HexOrientation } from '@tabletop/common'
    import type { TileDefinition, TileInventoryCount, TileUpgrades } from '@tabletop/18xx'
    import Tile from './Tile.svelte'
    import { ClassicTileAppearance, type TileAppearance } from './tileAppearance.js'
    import { placedTileLayout } from './standardTileLayouts.js'
    import type { TileLayout } from './tileDrawing.js'
    import { compareTileSimplicity } from './tilePresentation.js'
    import ModalPanel from '../presentation/ModalPanel.svelte'

    let {
        tiles,
        inventory,
        upgrades,
        layouts = {},
        orientation = HexOrientation.Flat,
        appearance = ClassicTileAppearance
    }: {
        tiles: readonly TileDefinition[]
        inventory: readonly TileInventoryCount[]
        upgrades: TileUpgrades
        layouts?: Readonly<Record<string, TileLayout>>
        orientation?: HexOrientation
        appearance?: TileAppearance
    } = $props()
    let color = $state('')
    let selectedId = $state<string>()
    let pointedId = $state<string>()
    const colors = $derived([...new Set(tiles.map((tile) => tile.face.color))])
    const remaining = $derived(
        new Map(inventory.map((entry) => [entry.definitionId, entry.available]))
    )
    const sorted = $derived(
        [...tiles].sort(
            (a, b) =>
                colors.indexOf(a.face.color) - colors.indexOf(b.face.color) ||
                (a.face.color === 'yellow'
                    ? a.face.labels.join(' ').localeCompare(b.face.labels.join(' '))
                    : 0) ||
                compareTileSimplicity(a, b)
        )
    )
    const visible = $derived(sorted.filter((tile) => !color || tile.face.color === color))
    const selected = $derived(tiles.find((tile) => tile.id === selectedId))
    const chain = $derived(selected ? upgrades.chain(selected.id) : new Set<string>())
    const chainRows = $derived(
        colors
            .map((rowColor) => ({
                color: rowColor,
                tiles: sorted.filter((tile) => tile.face.color === rowColor && chain.has(tile.id))
            }))
            .filter((row) => row.tiles.length)
    )
    const selectedRow = $derived(chainRows.findIndex((row) => row.color === selected?.face.color))
    const pointedLinks = $derived.by(() => {
        if (!pointedId || !chain.has(pointedId)) return undefined
        return new Set([
            pointedId,
            ...upgrades.upgradesTo(pointedId),
            ...upgrades.upgradesFrom(pointedId)
        ])
    })

    function remainingCount(definitionId: string): TileInventoryCount['available'] {
        const count = remaining.get(definitionId)
        assertExists(count, `The inventory counts tile ${definitionId}`)
        return count
    }

    function isAvailable(definitionId: string): boolean {
        const count = remainingCount(definitionId)
        return count === 'unlimited' || count > 0
    }

    function countText(definitionId: string): string {
        const count = remainingCount(definitionId)
        return count === 'unlimited' ? '∞' : `×${count}`
    }

    function colorName(value: string): string {
        return appearance.colorNames?.[value] ?? value
    }

    function stepText(row: number): string {
        return row === selectedRow || row - 1 === selectedRow ? 'upgrades to' : 'some upgrade to'
    }

    function pointAt(event: PointerEvent, definitionId: string | undefined) {
        if (event.pointerType === 'mouse') pointedId = definitionId
    }
</script>

{#snippet tileButton(tile: TileDefinition, inChain: boolean)}
    <button
        class="tile"
        class:exhausted={!isAvailable(tile.id)}
        class:unlinked={inChain && pointedLinks && !pointedLinks.has(tile.id)}
        aria-pressed={tile.id === selectedId}
        data-manifest-tile={inChain ? undefined : tile.id}
        data-chain-tile={inChain ? tile.id : undefined}
        data-tile-color={tile.face.color}
        onclick={() => (selectedId = tile.id)}
        onpointerenter={inChain ? (event) => pointAt(event, tile.id) : undefined}
        onpointerleave={inChain ? (event) => pointAt(event, undefined) : undefined}
    >
        <Tile
            face={tile.face}
            printedNumber={tile.printedNumber}
            {orientation}
            {appearance}
            layout={placedTileLayout(layouts, tile.id)}
            size="100%"
        />
        <span class="caption"
            ><span class="number">{tile.printedNumber}</span><span
                class="count"
                aria-label={`${remainingCount(tile.id)} remaining`}>{countText(tile.id)}</span
            ></span
        >
    </button>
{/snippet}

<section class="manifest" aria-label="Tile manifest">
    <div class="filters" role="group" aria-label="Tile colors">
        {#each ['', ...colors] as value (value)}
            <button
                aria-pressed={color === value}
                style:--swatch={value ? appearance.colors[value] : undefined}
                onclick={() => (color = value)}>{value ? colorName(value) : 'All'}</button
            >
        {/each}
    </div>
    {#if selected}
        <ModalPanel
            label={`Upgrades of tile ${selected.printedNumber}`}
            title={`Tile ${selected.printedNumber} upgrades`}
            closeLabel="Close upgrades"
            maxWidth="850px"
            onclose={() => (selectedId = undefined)}
        >
            {#if chainRows.length === 1}<p>
                    No tile upgrades to or from tile {selected.printedNumber}.
                </p>{/if}
            {#each chainRows as row, index (row.color)}
                {#if index}<p class="step" aria-hidden="true">{stepText(index)}</p>{/if}
                <div class="chain-tiles" role="group" aria-label={colorName(row.color)}>
                    {#each row.tiles as tile (tile.id)}
                        {@render tileButton(tile, true)}
                    {/each}
                </div>
            {/each}
        </ModalPanel>
    {/if}
    <div class="tiles" role="list" aria-label="Tiles">
        {#each visible as tile (tile.id)}
            <div role="listitem">{@render tileButton(tile, false)}</div>
        {/each}
    </div>
</section>

<style>
    .manifest {
        container-type: inline-size;
        padding: 0 16px 16px;
    }
    .filters {
        position: sticky;
        top: 0;
        z-index: 1;
        display: grid;
        grid-auto-columns: minmax(0, 1fr);
        grid-auto-flow: column;
        gap: 6px;
        margin: 0 -16px 12px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--rail-border, #443c3433);
        background: var(--rail-surface, #fffefa);
    }
    .filters button {
        min-width: 0;
        border: 1px solid var(--rail-border, #443c3433);
        border-radius: 6px;
        padding: 6px 2px;
        background: var(--swatch);
        color: #24211d;
        font: inherit;
        font-size: 12px;
        text-transform: capitalize;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
    }
    .filters button:first-child {
        background: var(--rail-surface, #fffefa);
        color: var(--rail-text, #24211d);
    }
    .filters button[aria-pressed='true'] {
        outline: 2px solid var(--rail-focus, #695540);
        outline-offset: 2px;
        font-weight: 600;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #695540);
        outline-offset: 2px;
    }
    .chain-tiles {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 2px;
    }
    .chain-tiles .tile {
        width: clamp(52px, min(17vw, 16dvh), 112px);
    }
    .step {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 2px 0;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }
    .step::before,
    .step::after {
        content: '';
        flex: 1;
        border-top: 1px solid var(--rail-border, #443c3433);
    }
    @media (max-height: 560px) {
        .step {
            margin: 0;
        }
    }
    .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(clamp(84px, 26cqi, 112px), 1fr));
        gap: 8px;
    }
    .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 4px;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .tile:hover {
        background: var(--rail-hover, #0000000a);
    }
    .tile[aria-pressed='true'] {
        border-color: var(--rail-focus, #695540);
        background: var(--rail-surface-selected, #e6dccd);
    }
    .tile.exhausted {
        opacity: 0.4;
    }
    .tile.unlinked {
        opacity: 0.15;
    }
    .caption {
        display: flex;
        gap: 6px;
        align-items: baseline;
    }
    .number {
        font-size: 11px;
        color: var(--rail-muted, #8b7b6b);
    }
    .count {
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
    p {
        margin: 4px 0;
        font-size: 13px;
        color: var(--rail-muted, #8b7b6b);
    }
</style>
