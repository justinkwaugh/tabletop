<script lang="ts">
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/utils/boardLayout.js'
    import ActionBoard from './board/ActionBoard.svelte'
    import EndGameMarker from './board/EndGameMarker.svelte'
    import MapLayer from './board/MapLayer.svelte'
    import MapLegend from './board/MapLegend.svelte'
    import RoundTracker from './board/RoundTracker.svelte'
    import TerrainLayer from './board/TerrainLayer.svelte'
</script>

<svg
    class="board"
    width={BOARD_WIDTH}
    height={BOARD_HEIGHT}
    viewBox="0 0 {BOARD_WIDTH} {BOARD_HEIGHT}"
    role="img"
    aria-label="Map of the Texas Hill Country"
>
    <TerrainLayer />
    <MapLayer />
    <MapLegend />
    <ActionBoard />
    <RoundTracker />
    <EndGameMarker />
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }
</style>
