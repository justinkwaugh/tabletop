<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import AutomaticDevelopmentNote from './board/AutomaticDevelopmentNote.svelte'
    import BorderLayer from './board/BorderLayer.svelte'
    import OneWayLayer from './board/OneWayLayer.svelte'
    import RulesReminderPanel from './board/RulesReminderPanel.svelte'
    import ExternalLayer from './board/ExternalLayer.svelte'
    import FinalPayoffPanel from './board/FinalPayoffPanel.svelte'
    import Legend from './board/Legend.svelte'
    import Logo from './board/Logo.svelte'
    import MapBackground from './board/MapBackground.svelte'
    import SettlementLayer from './board/SettlementLayer.svelte'
    import SpecialConnectionPanel from './board/SpecialConnectionPanel.svelte'
    import TrackLayer from './board/TrackLayer.svelte'

    const gameSession = getGameSession()

    // The paper's corner radius, so the board's shadow follows its rounded edge.
    const BOARD_CORNER = 18

    const layout = $derived(boardLayout(gameSession.gameState.mapId))
</script>

<svg
    class="board"
    width={layout.width}
    height={layout.height}
    viewBox="0 {layout.top} {layout.width} {layout.height}"
    style:border-radius="{(BOARD_CORNER / layout.width) * 100}% / {(BOARD_CORNER / layout.height) *
        100}%"
    role="img"
    aria-label="Map of the {gameSession.gameState.map.definition.name} railroads"
>
    <MapBackground />
    <Logo />
    <Legend />
    <FinalPayoffPanel />
    <SpecialConnectionPanel />
    <AutomaticDevelopmentNote />
    <RulesReminderPanel />
    <BorderLayer />
    <ExternalLayer />
    <TrackLayer />
    <SettlementLayer />
    <OneWayLayer />
</svg>

<style>
    .board {
        display: block;
        user-select: none;
        /* The printed sheet lies on the table. */
        box-shadow: 0 3px 8px rgba(25, 40, 55, 0.28);
        /* Unhinted, so text keeps the width the printed panels are sized for at any zoom. */
        text-rendering: geometricPrecision;
    }
</style>
