<script lang="ts">
    import { economicTileChoices } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ECONOMIC_TILE_LABELS } from '$lib/utils/presentation.js'

    // Hive Mind: its owner chooses the economic tile from those left in the cycle.
    const gameSession = getGameSession()
    const choices = $derived(economicTileChoices(gameSession.gameState))
</script>

<div class="sh-step">
    <p class="hint">
        Hive Mind: choose this turn's economic tile from those left in the cycle. The tile of last
        turn cannot come again.
    </p>
    <div class="row">
        {#each choices as tile (tile)}
            <button type="button" onclick={() => gameSession.chooseEconomicTile(tile)}
                >{ECONOMIC_TILE_LABELS[tile]}</button
            >
        {/each}
    </div>
</div>

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
</style>
