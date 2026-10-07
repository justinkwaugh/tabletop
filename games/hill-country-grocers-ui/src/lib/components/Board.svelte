<script lang="ts">
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/utils/boardLayout.js'
    import ActionBoard from './board/ActionBoard.svelte'
    import CompanyCards from './board/CompanyCards.svelte'
    import MapLayer from './board/MapLayer.svelte'
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
    <MapLayer />
    <ActionBoard />
    <RoundTracker />
    <CompanyCards />
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }
</style>
