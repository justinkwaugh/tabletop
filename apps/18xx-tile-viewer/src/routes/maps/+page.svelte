<script lang="ts">
    import {
        MapViewer,
        createMapDrawing,
        ClassicTileAppearance,
        MutedTileAppearance,
        type MapSelection
    } from '@tabletop/18xx-ui'
    import { MapExamples } from '../../demo/maps.js'
    import '../../map.css'

    let title = $state<'TOP' | '1889'>('TOP')
    let prepared = $state(false)
    let appearance = $state(ClassicTileAppearance)
    const example = $derived(MapExamples[title])
    const scene = $derived(
        createMapDrawing(example.map, {
            tileSet: example.tileSet,
            inventory: prepared ? example.prepared : example.initial
        })
    )
    let selection = $derived.by((): MapSelection | undefined => {
        scene
        return undefined
    })
</script>

<svelte:head><title>18xx maps</title></svelte:head>
<main>
    <nav>
        <a href="/">Tile library</a><a href="/specimens">Tile specimens</a><a href="/economy"
            >Finances</a
        >
    </nav>
    <header>
        <label
            >Map<select bind:value={title}
                ><option value="TOP">The Old Prince 1871</option><option value="1889"
                    >Shikoku 1889</option
                ></select
            ></label
        >
        <label
            >Tile style<select bind:value={appearance}
                ><option value={ClassicTileAppearance}>Classic</option><option
                    value={MutedTileAppearance}>Muted</option
                ></select
            ></label
        >
        <label class="checkbox"
            ><input type="checkbox" bind:checked={prepared} />Show sample tile, token & route</label
        >
    </header>
    <MapViewer
        {scene}
        {selection}
        {appearance}
        tokens={prepared ? example.tokens : []}
        routes={prepared ? example.routes : []}
        onselect={(next) => (selection = next)}
    />
</main>

<style>
    :global(body) {
        margin: 0;
        background: #edf0e9;
        color: #25363a;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    main {
        padding: 18px;
        max-width: 1800px;
        margin: auto;
    }
    nav,
    header {
        display: flex;
        gap: 14px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 18px;
    }
    a {
        color: #28554c;
        font-size: 13px;
    }
    header {
        align-items: flex-end;
    }
    label {
        display: grid;
        gap: 4px;
        font-size: 12px;
    }
    label.checkbox {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 40px;
    }
    select {
        font: inherit;
        padding: 9px 12px;
        border: 1px solid #b5c3ba;
        border-radius: 6px;
        background: #fffefa;
        min-height: 40px;
    }
    select {
        appearance: none;
        padding-right: 36px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='m3 4.5 3 3 3-3' fill='none' stroke='%2352545b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
    }
</style>
