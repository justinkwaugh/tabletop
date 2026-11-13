<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const claim = $derived(gameSession.gameState.transcontinental)
</script>

<!-- R-4.3.3, Contract, Phone layout: phones leave the board's margin out, so the claimed
     Transcontinental's medallion ends the strip, ringed in the claimant's colour. -->
{#if claim}
    {@const name = gameSession.getPlayerName(claim.playerId)}
    <div
        class="medallion rtr-display"
        role="img"
        aria-label="Transcontinental: claimed by {name} for ${claim.amount}"
        style:border-color={gameSession.colors.getPlayerUiColor(claim.playerId)}
    >
        ${claim.amount}
    </div>
{/if}

<style>
    .medallion {
        flex: none;
        align-self: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 3px solid;
        background: var(--rtr-gold);
        color: var(--rtr-ink-light);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
    }
</style>
