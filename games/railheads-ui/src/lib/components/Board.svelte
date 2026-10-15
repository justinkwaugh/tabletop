<script lang="ts">
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/utils/boardLayout.js'
    import BoostPicker from './board/BoostPicker.svelte'
    import Legend from './board/Legend.svelte'
    import MapLayer from './board/MapLayer.svelte'
    import RevenueTrack from './board/RevenueTrack.svelte'
    import TargetLayer from './board/TargetLayer.svelte'
    import TrackLayer from './board/TrackLayer.svelte'
</script>

<svg
    class="board"
    width={BOARD_WIDTH}
    height={BOARD_HEIGHT}
    viewBox="0 0 {BOARD_WIDTH} {BOARD_HEIGHT}"
    role="img"
    aria-label="Map of the railroads"
>
    <RevenueTrack />
    <Legend />
    <MapLayer />
    <TrackLayer />
    <TargetLayer />
    <BoostPicker />
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }
</style>
