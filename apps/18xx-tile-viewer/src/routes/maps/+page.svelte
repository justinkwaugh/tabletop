<script lang="ts">
    import { ScalingWrapper } from '@tabletop/frontend-components'
    import {
        MapScene,
        MapInspector,
        createMapDrawing,
        mapSelectionPoint,
        ClassicTileAppearance,
        MutedTileAppearance,
        type MapSelection
    } from '@tabletop/18xx-ui'
    import { MapExamples } from '../../demo/maps.js'
    import '../../map.css'

    let title = $state<'TOP' | '1889'>('TOP')
    let prepared = $state(false)
    let appearance = $state(ClassicTileAppearance)
    let wrapper = $state<ScalingWrapper>()
    const hexDiameter = 180
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

    function focusSelection() {
        if (!selection) return
        const point = mapSelectionPoint(scene, selection)
        const scale = hexDiameter / 100
        wrapper?.focusRect(
            {
                x: (point.x - scene.bounds.x - 60) * scale,
                y: (point.y - scene.bounds.y - 60) * scale,
                width: 120 * scale,
                height: 120 * scale
            },
            { animate: true }
        )
    }
</script>

<svelte:head><title>18xx maps</title></svelte:head>
<main>
    <nav><a href="/">Tile library</a><a href="/specimens">Tile specimens</a></nav>
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
        <div class="map-actions">
            <button onclick={() => wrapper?.fitToContent({ animate: true })}>Fit map</button>
            <button disabled={!selection} onclick={focusSelection}>Focus selection</button>
        </div>
    </header>
    <div class="workspace">
        <section class="map-viewport" aria-label="Map viewport">
            {#key title}
                <ScalingWrapper
                    bind:this={wrapper}
                    justify="center"
                    controls="bottom-left"
                    expandable={true}
                >
                    <MapScene
                        {scene}
                        {selection}
                        {appearance}
                        {hexDiameter}
                        tokens={prepared ? example.tokens : []}
                        routes={prepared ? example.routes : []}
                        onselect={(next) => (selection = next)}
                    />
                </ScalingWrapper>
            {/key}
        </section>
        <div class="inspection"><MapInspector {scene} {selection} /></div>
    </div>
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
    .map-actions {
        display: flex;
        gap: 14px;
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
    select,
    button {
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
    button {
        font-size: 12px;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .workspace {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 270px;
        gap: 20px;
    }
    .map-viewport {
        height: calc(100dvh - 150px);
        min-height: 330px;
        overflow: hidden;
        border: 1px solid #b7c8c8;
        border-radius: 8px;
        background: #cbdfe1;
    }
    .inspection {
        padding: 14px;
        background: #fffefa;
        border-radius: 8px;
    }
    @media (max-width: 800px) {
        .workspace {
            grid-template-columns: minmax(0, 1fr);
        }
        .map-viewport {
            height: 60dvh;
        }
    }
</style>
