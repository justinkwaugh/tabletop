<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import BoostPicker from './board/BoostPicker.svelte'
    import EndgamePanel from './board/EndgamePanel.svelte'
    import Legend from './board/Legend.svelte'
    import Logo from './board/Logo.svelte'
    import MapLayer from './board/MapLayer.svelte'
    import RevenueTrack from './board/RevenueTrack.svelte'
    import TargetLayer from './board/TargetLayer.svelte'
    import TrackLayer from './board/TrackLayer.svelte'

    const gameSession = getGameSession()

    const layout = $derived(boardLayout(gameSession.gameState.editionId))
</script>

<svg
    class="board"
    width={layout.width}
    height={layout.height}
    viewBox="0 0 {layout.width} {layout.height}"
    role="img"
    aria-label="Map of the railroads"
>
    <RevenueTrack />
    <Legend />
    <EndgamePanel />
    <Logo />
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
