<script lang="ts">
    import { HexOrientation } from '@tabletop/common'
    import {
        rotateTileEdge,
        type TileDefinition,
        type TileRotation,
        type TileInventoryCount
    } from '@tabletop/18xx'
    import Tile from './Tile.svelte'
    import { ClassicTileAppearance, MutedTileAppearance } from './tileAppearance.js'
    import type { TileLayout } from './tileDrawing.js'
    import { StandardTileLayouts } from './standardTileLayouts.js'
    import {
        filterTileDefinitions,
        tileRevenueText,
        type TileLibraryFilter
    } from './tilePresentation.js'

    let {
        tiles,
        title = 'Tile library',
        layouts = StandardTileLayouts,
        inventory,
        onchoose
    }: {
        tiles: readonly TileDefinition[]
        title?: string
        layouts?: Readonly<Record<string, TileLayout>>
        inventory?: readonly TileInventoryCount[]
        onchoose?: (selection: { definitionId: string; rotation: TileRotation }) => void
    } = $props()
    let appearance = $state(ClassicTileAppearance)
    let search = $state('')
    let color = $state('')
    let track = $state<TileLibraryFilter['track']>('all')
    let stop = $state<TileLibraryFilter['stop']>('all')
    let orientation = $state(HexOrientation.Flat)
    let detailPanel: HTMLElement | undefined = $state()
    const visible = $derived(filterTileDefinitions(tiles, { search, color, track, stop }))
    const colors = $derived([...new Set(tiles.map((tile) => tile.face.color))])
    let inspection = $derived<{ id: string; rotation: TileRotation; pathId?: string } | undefined>(
        visible[0] ? { id: visible[0].id, rotation: 0 } : undefined
    )
    const selected = $derived(visible.find((tile) => tile.id === inspection?.id))
    const supply = $derived(new Map(inventory?.map((count) => [count.definitionId, count])))

    function inspect(id: string) {
        inspection = { id, rotation: 0 }
        detailPanel?.scrollIntoView({ block: 'nearest' })
    }

    function resetFilters() {
        search = ''
        color = ''
        track = 'all'
        stop = 'all'
    }
</script>

<section class="tile-library" aria-label={title}>
    <header>
        <h2>{title}</h2>
        <span class="count" aria-live="polite">{visible.length} of {tiles.length} definitions</span>
    </header>
    <div class="filters">
        <label class="search"
            >Find a tile<input
                type="search"
                bind:value={search}
                placeholder="Number, label, or title…"
            /></label
        >
        <label
            >Color<select bind:value={color}
                ><option value="">All colors</option>{#each colors as value}<option {value}
                        >{value}</option
                    >{/each}</select
            ></label
        >
        <label
            >Track<select bind:value={track}
                ><option value="all">All track</option><option value="edge">Edge to edge</option
                ><option value="node">Through a node</option></select
            ></label
        >
        <label
            >Stop<select bind:value={stop}
                ><option value="all">All stops</option><option value="city">City</option><option
                    value="town">Town</option
                ><option value="offboard">Offboard</option><option value="junction">Junction</option
                ></select
            ></label
        >
    </div>
    <div class="body">
        <aside class="detail" bind:this={detailPanel} aria-label="Tile inspection">
            {#if selected && inspection}
                <div class="detail-heading">
                    <h3>{selected.printedNumber}</h3>
                    <span class="tag">{selected.face.color}</span>
                </div>
                <p class="scope">{selected.scope}</p>
                {#if selected.face.upgradeCost !== undefined}<p class="scope">
                        Cost to upgrade: {selected.face.upgradeCost}
                    </p>{/if}
                {#if supply.has(selected.id)}
                    {@const count = supply.get(selected.id)!}
                    <p class="scope" data-tile-inventory>
                        {count.available === 'unlimited'
                            ? 'Unlimited'
                            : `${count.available} of ${count.total} available`}
                    </p>
                {/if}
                <div class="large-tile">
                    <Tile
                        face={selected.face}
                        printedNumber={selected.printedNumber}
                        {orientation}
                        {appearance}
                        rotation={inspection.rotation}
                        layout={layouts[selected.id]}
                        size="100%"
                        highlightedPathIds={inspection.pathId ? [inspection.pathId] : []}
                    />
                </div>
                <div class="rotation">
                    <button
                        aria-label="Rotate counterclockwise"
                        onclick={() => {
                            if (inspection)
                                inspection = {
                                    ...inspection,
                                    rotation: rotateTileEdge(inspection.rotation, 5)
                                }
                        }}>↶</button
                    >
                    <output aria-label="Rotation">{inspection.rotation * 60}°</output>
                    <button
                        aria-label="Rotate clockwise"
                        onclick={() => {
                            if (inspection)
                                inspection = {
                                    ...inspection,
                                    rotation: rotateTileEdge(inspection.rotation, 1)
                                }
                        }}>↷</button
                    >
                    <button
                        class="reset"
                        onclick={() => {
                            if (inspection)
                                inspection = { ...inspection, rotation: 0, pathId: undefined }
                        }}>Reset</button
                    >
                </div>
                <label class="orientation"
                    >Hex orientation<select bind:value={orientation}
                        ><option value={HexOrientation.Flat}>Flat top</option><option
                            value={HexOrientation.Pointy}>Pointy top</option
                        ></select
                    ></label
                >
                <label class="orientation"
                    >Tile style<select bind:value={appearance}
                        ><option value={ClassicTileAppearance}>Classic</option><option
                            value={MutedTileAppearance}>Muted</option
                        ></select
                    ></label
                >
                <dl>
                    <dt>Catalog ID</dt>
                    <dd class="identifier">{selected.id}</dd>
                    {#if selected.aliases.length}<dt>Also known as</dt>
                        <dd>{selected.aliases.join(', ')}</dd>{/if}
                    <dt>Labels</dt>
                    <dd>{selected.face.labels.join(', ') || 'None'}</dd>
                    {#each selected.face.nodes as node (node.id)}
                        <dt>{node.kind}{selected.face.nodes.length > 1 ? ` · ${node.id}` : ''}</dt>
                        <dd>
                            {#if node.kind !== 'junction'}{tileRevenueText(node.revenue)} revenue{#if node.kind === 'city'}
                                    · {node.stationSlots} token {node.stationSlots === 1
                                        ? 'space'
                                        : 'spaces'}{/if}{:else}Track connection{/if}
                        </dd>
                    {/each}
                </dl>
                <div class="paths" aria-label="Track segments">
                    <p>Inspect a track segment</p>
                    {#each selected.face.paths as path, index (path.id)}
                        <button
                            aria-pressed={inspection.pathId === path.id}
                            onclick={() => {
                                if (inspection)
                                    inspection = {
                                        ...inspection,
                                        pathId: inspection.pathId === path.id ? undefined : path.id
                                    }
                            }}
                        >
                            {index + 1}: {path.endpoints
                                .map((endpoint) =>
                                    endpoint.kind === 'edge'
                                        ? `edge ${rotateTileEdge(endpoint.edge, inspection?.rotation ?? 0)}`
                                        : endpoint.nodeId
                                )
                                .join(' ↔ ')}
                        </button>
                    {/each}
                </div>
                {#if onchoose}<button
                        class="choose"
                        onclick={() => {
                            if (selected && inspection)
                                onchoose?.({
                                    definitionId: selected.id,
                                    rotation: inspection.rotation
                                })
                        }}>Use tile {selected.printedNumber}</button
                    >{/if}
            {:else}
                <p class="empty">No matching tiles.</p>
                <button onclick={resetFilters}>Clear filters</button>
            {/if}
        </aside>
        <div class="catalog">
            {#if !visible.length}<p class="empty">Try a different number, label, or filter.</p>{/if}
            <div class="tiles" aria-label="Catalog tiles">
                {#each visible as tile (tile.id)}
                    <button
                        class="tile-card"
                        aria-label={`Inspect ${tile.printedNumber}, ${tile.scope}`}
                        aria-pressed={selected?.id === tile.id}
                        onclick={() => inspect(tile.id)}
                    >
                        <Tile
                            face={tile.face}
                            printedNumber={tile.printedNumber}
                            {orientation}
                            {appearance}
                            layout={layouts[tile.id]}
                            size="100%"
                        />
                        {#if supply.has(tile.id)}
                            {@const count = supply.get(tile.id)!}
                            <span class="scope" data-tile-inventory
                                >{count.available === 'unlimited'
                                    ? 'Unlimited'
                                    : `${count.available} / ${count.total} available`}</span
                            >
                        {/if}
                        <span class="card-title"
                            >{tile.printedNumber}<span>{tile.face.labels.join(' · ')}</span></span
                        >
                        <span class="card-scope">{tile.scope}</span>
                    </button>
                {/each}
            </div>
        </div>
    </div>
</section>

<style>
    .tile-library {
        container-type: inline-size;
        color: var(--rail-text, #292e28);
        background: var(--rail-surface, #faf8f1);
        font-family: ui-sans-serif, system-ui, sans-serif;
        border: 1px solid var(--rail-border, #d9d9c9);
        border-radius: 16px;
        padding: clamp(14px, 3%, 28px);
    }
    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 24px;
    }
    h2 {
        margin: 0;
        font-size: clamp(23px, 4cqi, 32px);
        font-weight: 650;
        letter-spacing: -0.045em;
    }
    .count {
        font-size: 12px;
        color: var(--rail-text, #66715f);
    }
    .filters {
        display: grid;
        grid-template-columns: 2fr 1fr 1.4fr 1fr;
        gap: 12px;
        padding-bottom: 22px;
        border-bottom: 1px solid var(--rail-border, #d9d9c9);
        margin-bottom: 22px;
    }
    label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
    }
    input,
    select,
    button {
        font: inherit;
    }
    input,
    select {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        background: var(--rail-surface, #fffef9);
        color: var(--rail-text, #292e28);
        border: 1px solid var(--rail-border, #c8ccbf);
        border-radius: 6px;
        padding: 10px;
        min-height: 42px;
        font-size: 13px;
    }
    button {
        cursor: pointer;
        color: inherit;
        background: var(--rail-surface, #fffef9);
        border: 1px solid var(--rail-border, #c8ccbf);
        border-radius: 7px;
        min-height: 44px;
        padding: 8px 12px;
    }
    button:hover {
        border-color: var(--rail-focus, #63765f);
        background: var(--rail-surface, #f2f3e9);
    }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible {
        outline: 3px solid #397965;
        outline-offset: 3px;
    }
    .body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(225px, 31%);
        gap: 26px;
        align-items: start;
    }
    .detail {
        grid-column: 2;
        grid-row: 1;
        min-width: 0;
        padding: 18px;
        background: var(--rail-surface-raised, #eeeee3);
        border-radius: 12px;
    }
    .detail-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
    }
    h3 {
        margin: 0;
        font-size: 27px;
        letter-spacing: -0.04em;
    }
    .tag {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        border: 1px solid var(--rail-border, #bcc3b2);
        border-radius: 4px;
        padding: 4px 7px;
    }
    .scope {
        font-size: 12px;
        color: var(--rail-text, #5c6559);
        margin: 5px 0 10px;
    }
    .large-tile {
        max-width: 300px;
        margin: 0 auto;
    }
    .rotation {
        display: flex;
        align-items: center;
        gap: 7px;
        justify-content: center;
    }
    .rotation button {
        font-size: 21px;
        min-width: 44px;
    }
    .rotation output {
        font-size: 13px;
        min-width: 33px;
        text-align: center;
    }
    .rotation .reset {
        font-size: 12px;
    }
    .orientation {
        margin-top: 14px;
    }
    dl {
        margin: 18px 0;
        font-size: 12px;
    }
    dt {
        color: var(--rail-text, #5c6559);
        margin-top: 12px;
        text-transform: capitalize;
    }
    dd {
        margin: 4px 0 0;
        line-height: 1.5;
    }
    .identifier {
        overflow-wrap: anywhere;
        font-family: ui-monospace, monospace;
        font-size: 11px;
    }
    .paths {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }
    .paths p {
        flex-basis: 100%;
        font-size: 11px;
        color: var(--rail-text, #5c6559);
        margin: 0 0 2px;
    }
    .paths button {
        font-size: 11px;
        min-height: 34px;
        padding: 6px 8px;
    }
    .paths button[aria-pressed='true'] {
        border-color: #b32747;
        background: var(--rail-surface, #ffe9ed);
    }
    .choose {
        margin-top: 16px;
        width: 100%;
        background: #254e3e;
        color: white;
        border-color: #254e3e;
    }
    .choose:hover {
        background: #36634f;
    }
    .catalog {
        grid-column: 1;
        grid-row: 1;
        min-width: 0;
    }
    .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
        gap: 12px;
    }
    .tile-card {
        text-align: left;
        padding: 10px;
        min-width: 0;
    }
    .tile-card[aria-pressed='true'] {
        border-color: #397965;
        box-shadow: 0 0 0 2px #397965;
        background: var(--rail-surface, #f0f5eb);
    }
    .card-title {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        align-items: baseline;
        font-size: 15px;
        font-weight: 750;
        margin-top: 7px;
    }
    .card-title span {
        font-size: 11px;
        font-weight: 600;
    }
    .card-scope {
        display: block;
        font-size: 10px;
        line-height: 1.4;
        color: var(--rail-text, #65705f);
        margin-top: 4px;
    }
    .empty {
        color: var(--rail-text, #65705f);
        font-size: 14px;
        line-height: 1.5;
    }
    @container (max-width: 650px) {
        .filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .search {
            grid-column: 1 / -1;
        }
        .body {
            grid-template-columns: minmax(0, 1fr);
            gap: 20px;
        }
        .detail {
            grid-column: 1;
            grid-row: 1;
        }
        .catalog {
            grid-column: 1;
            grid-row: 2;
        }
        .large-tile {
            max-width: 220px;
        }
        .tiles {
            grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        }
        .paths button {
            min-height: 44px;
        }
    }
</style>
