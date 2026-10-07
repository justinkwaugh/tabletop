<script lang="ts">
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/utils/boardLayout.js'
    import ActionBoard from './board/ActionBoard.svelte'
    import CompanyCards from './board/CompanyCards.svelte'
    import DividendRules from './board/DividendRules.svelte'
    import EndGameTracker from './board/EndGameTracker.svelte'
    import MapLayer from './board/MapLayer.svelte'
    import MapLegend from './board/MapLegend.svelte'
    import MapControls from './board/MapControls.svelte'
    import TerrainLayer from './board/TerrainLayer.svelte'

    let {
        onZoomToMap,
        onShowBoard,
        onToggleFullScreen
    }: { onZoomToMap: () => void; onShowBoard: () => void; onToggleFullScreen: () => void } =
        $props()
    import RoundTracker from './board/RoundTracker.svelte'
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
    <MapControls {onZoomToMap} {onShowBoard} {onToggleFullScreen} />
    <ActionBoard />
    <RoundTracker />
    <CompanyCards />
    <EndGameTracker />
    <DividendRules />
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }
</style>
