<script lang="ts">
    import { BOARD_DRAWN_SCALE as DRAWN_SCALE } from '$lib/model/boardFraming.js'
    import { BOARD_BOUNDS } from '$lib/utils/boardGeometry.js'
    import ChipLayer from './board/ChipLayer.svelte'
    import HitTargetLayer from './board/HitTargetLayer.svelte'
    import MapLayer from './board/MapLayer.svelte'
    import MoneyMarkerLayer from './board/MoneyMarkerLayer.svelte'
    import PickChrome from './board/PickChrome.svelte'
    import PriceMarkerLayer from './board/PriceMarkerLayer.svelte'
    import StripLayer from './board/StripLayer.svelte'
    import ThisTurnLayer from './board/ThisTurnLayer.svelte'
    import TownTileLayer from './board/TownTileLayer.svelte'
    import TrackPieceLayer from './board/TrackPieceLayer.svelte'
</script>

<svg
    class="board"
    width={BOARD_BOUNDS.width * DRAWN_SCALE}
    height={BOARD_BOUNDS.height * DRAWN_SCALE}
    viewBox="{BOARD_BOUNDS.x} {BOARD_BOUNDS.y} {BOARD_BOUNDS.width} {BOARD_BOUNDS.height}"
    aria-label="Promontory Point board"
>
    <g data-layer="map"><MapLayer /></g>
    <g data-layer="town-tiles" class="pointer-events-none"><TownTileLayer /></g>
    <g data-layer="track-pieces" class="pointer-events-none"><TrackPieceLayer /></g>
    <g data-layer="this-turn" class="pointer-events-none"><ThisTurnLayer /></g>
    <g data-layer="price-markers" class="pointer-events-none"><PriceMarkerLayer /></g>
    <g data-layer="money-markers" class="pointer-events-none"><MoneyMarkerLayer /></g>
    <g data-layer="strip" class="pointer-events-none"><StripLayer /></g>
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

    .board :global(.pp-board-italic) {
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        font-weight: 400;
    }

    .board :global(.pp-strip-heading) {
        letter-spacing: 6px;
    }

    .board :global(.pp-board-line) {
        dominant-baseline: central;
        font-family: Oswald, sans-serif;
        font-weight: 500;
    }
</style>
