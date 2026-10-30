<script lang="ts">
    import { MAP_SIZE } from '$lib/utils/boardGeometry.js'
    import ChipLayer from './board/ChipLayer.svelte'
    import HitTargetLayer from './board/HitTargetLayer.svelte'
    import MapLayer from './board/MapLayer.svelte'
    import MoneyMarkerLayer from './board/MoneyMarkerLayer.svelte'
    import PickChrome from './board/PickChrome.svelte'
    import PriceMarkerLayer from './board/PriceMarkerLayer.svelte'
    import SeaLayer from './board/SeaLayer.svelte'
    import ThisTurnLayer from './board/ThisTurnLayer.svelte'
    import TownTileLayer from './board/TownTileLayer.svelte'
    import TrackPieceLayer from './board/TrackPieceLayer.svelte'

    // Drawn at half the map's pixels; the scaling wrapper zooms up to them.
    const DRAWN_SCALE = 0.5
</script>

<svg
    class="board"
    width={MAP_SIZE.width * DRAWN_SCALE}
    height={MAP_SIZE.height * DRAWN_SCALE}
    viewBox="0 0 {MAP_SIZE.width} {MAP_SIZE.height}"
    aria-label="Promontory Point board"
>
    <g data-layer="map"><MapLayer /></g>
    <g data-layer="town-tiles" class="pointer-events-none"><TownTileLayer /></g>
    <g data-layer="track-pieces" class="pointer-events-none"><TrackPieceLayer /></g>
    <g data-layer="this-turn" class="pointer-events-none"><ThisTurnLayer /></g>
    <g data-layer="price-markers" class="pointer-events-none"><PriceMarkerLayer /></g>
    <g data-layer="money-markers" class="pointer-events-none"><MoneyMarkerLayer /></g>
    <g data-layer="sea" class="pointer-events-none"><SeaLayer /></g>
    <g data-layer="pick-chrome"><PickChrome /></g>
    <g data-layer="hit-targets"><HitTargetLayer /></g>
    <g data-layer="chips"><ChipLayer /></g>
</svg>

<style>
    .board {
        display: block;
    }

    .board :global(.pp-board-figure) {
        text-anchor: middle;
        dominant-baseline: central;
        font-family: Oswald, sans-serif;
        font-weight: 600;
    }

    .board :global(.pp-board-caption) {
        font-family: Oswald, sans-serif;
        font-weight: 500;
        letter-spacing: 1px;
    }

    .board :global(.pp-board-line) {
        dominant-baseline: central;
        font-family: Oswald, sans-serif;
        font-weight: 500;
    }
</style>
