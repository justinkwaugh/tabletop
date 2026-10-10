<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const returned = $derived(gameSession.gameState.polypsReturnedWhenEating())
    const shrimpGoesToOpenSea = $derived(!gameSession.myPlayerState?.shrimpOnOpenSea)
</script>

<p class="prompt reef-display">Choose a coral for your parrotfish</p>
<p class="detail">
    {returned} of its polyps go back into the bag and the rest feed your parrotfish. Your shrimp on it
    {shrimpGoesToOpenSea ? 'goes onto the open sea' : 'is eaten too'}. Undo cancels.
</p>
{#if gameSession.eatingStartsFinalTurns}
    <p class="warning">
        This is your parrotfish's fourth shrimp: eating ends the game, and every other player then
        has one final turn.
    </p>
{/if}
