<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AllowanceList from './AllowanceList.svelte'
    import SeatSquares from './SeatSquares.svelte'

    const CORNER_RADIUS = 22
    const SLOPE_WIDTH = 80

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const currentPlayerId = $derived(
        gameState.result ? undefined : gameState.turnManager.turnOrder[gameState.turnIndex]
    )

    let width = $state(0)
    let height = $state(0)

    const outline = $derived(
        width > 0
            ? `path('M 0 ${height} V ${CORNER_RADIUS} A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 ${CORNER_RADIUS} 0 H ${width - SLOPE_WIDTH} C ${width - SLOPE_WIDTH / 2} 0 ${width - SLOPE_WIDTH / 2} ${height} ${width} ${height} Z')`
            : undefined
    )
</script>

<div
    class="round-tab"
    style:padding-right="{SLOPE_WIDTH}px"
    style:clip-path={outline}
    bind:offsetWidth={width}
    bind:offsetHeight={height}
>
    <span class="round-label">
        Round <span class="round-number">{gameState.round + 1}</span> of
        <span class="round-number">{gameState.roundCount}</span>
    </span>

    <div class="section">
        <AllowanceList card={gameState.currentCard()} label="This round's actions" />
    </div>

    <div class="section">
        <SeatSquares playerIds={gameState.turnManager.turnOrder} {currentPlayerId} />
    </div>
</div>

<style>
    .round-tab {
        display: flex;
        align-items: center;
        gap: 28px;
        height: var(--tab-height);
        margin-bottom: -1px;
        padding-left: 28px;
        background:
            radial-gradient(
                var(--sheet-light-size) at var(--sheet-light-x)
                    calc(var(--sheet-light-y) + var(--tab-height) - 1px),
                rgba(255, 255, 255, 0.35),
                transparent 60%
            ),
            var(--sheet-color);
        color: #4a2c12;
        font-family: 'Libre Baskerville', Georgia, serif;
        white-space: nowrap;
    }

    .round-label {
        font-size: 30px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .round-number {
        font-size: 40px;
        font-weight: 700;
    }

    .section {
        display: flex;
        align-items: center;
        height: 44px;
        padding-left: 28px;
        border-left: 2px solid #c9b394;
    }
</style>
