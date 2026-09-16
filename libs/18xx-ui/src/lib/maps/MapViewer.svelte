<script lang="ts">
    import { ScalingWrapper } from '@tabletop/frontend-components'
    import type { StationReservation } from '@tabletop/18xx'
    import MapScene from './MapScene.svelte'
    import MapInspector from './MapInspector.svelte'
    import {
        mapSelectionRect,
        type MapDrawing,
        type MapSelection,
        type MapToken,
        type MapRoute
    } from './mapDrawing.js'
    import { ClassicTileAppearance, type TileAppearance } from '../tiles/tileAppearance.js'
    let {
        scene,
        legalLocationIds = [],
        highlightedLocationIds = legalLocationIds,
        maskUnavailableLocations = false,
        previewLocationId,
        selection,
        tokens = [],
        routes = [],
        reservations,
        appearance = ClassicTileAppearance,
        revenueStageColors,
        onselect
    }: {
        scene: MapDrawing
        legalLocationIds?: readonly string[]
        highlightedLocationIds?: readonly string[]
        maskUnavailableLocations?: boolean
        previewLocationId?: string
        selection?: MapSelection
        tokens?: readonly MapToken[]
        routes?: readonly MapRoute[]
        reservations?: readonly StationReservation[]
        revenueStageColors?: Readonly<Record<string, string>>
        appearance?: TileAppearance
        onselect?: (selection: MapSelection) => void
    } = $props()
    let wrapper = $state<ScalingWrapper>()
    const hexDiameter = 180
    function focusSelection() {
        if (!selection) return
        wrapper?.focusRect(mapSelectionRect(scene, selection, hexDiameter), { animate: true })
    }
</script>

<div class="map-actions">
    <button onclick={() => wrapper?.fitToContent({ animate: true })}>Fit map</button>
    <button disabled={!selection} onclick={focusSelection}>Focus selection</button>
</div>
<div class="map-workspace">
    <section class="map-viewport" aria-label="Map viewport">
        {#key scene.map.definition.id}
            <ScalingWrapper
                bind:this={wrapper}
                justify="center"
                controls="bottom-left"
                expandable={true}
            >
                <MapScene
                    {scene}
                    {legalLocationIds}
                    {highlightedLocationIds}
                    {maskUnavailableLocations}
                    {previewLocationId}
                    {selection}
                    {tokens}
                    {routes}
                    {reservations}
                    {appearance}
                {revenueStageColors}
                    {hexDiameter}
                    {onselect}
                />
            </ScalingWrapper>
        {/key}
    </section>
    <MapInspector {scene} {selection} {tokens} {reservations} />
</div>

<style>
    .map-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
    }
    button {
        padding: 8px 12px;
        border: 1px solid var(--rail-border, #b5c3ba);
        border-radius: 5px;
        background: var(--rail-surface, #fffefa);
        font: inherit;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .map-workspace {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 240px;
        gap: 16px;
    }
    .map-viewport {
        height: 520px;
        overflow: hidden;
        border: 1px solid #b7c8c8;
        border-radius: 8px;
        background: #cbdfe1;
    }
    @media (max-width: 800px) {
        .map-workspace {
            grid-template-columns: minmax(0, 1fr);
        }
        .map-viewport {
            height: 60dvh;
        }
    }
</style>
