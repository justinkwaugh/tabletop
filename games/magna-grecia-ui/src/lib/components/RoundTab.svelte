<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import FolderTab from './FolderTab.svelte'
    import SeatSquares from './SeatSquares.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const currentPlayerId = $derived(
        gameState.result ? undefined : gameState.turnManager.turnOrder[gameState.turnIndex]
    )
</script>

<FolderTab side="left" label="Current round">
    <span class="round-label">
        Round <span class="round-number">{gameState.round + 1}</span> of
        <span class="round-number">{gameState.roundCount}</span>
    </span>

    <div class="section">
        <SeatSquares playerIds={gameState.turnManager.turnOrder} {currentPlayerId} />
    </div>
</FolderTab>

<style>
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
