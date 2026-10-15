<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const returned = $derived(gameSession.gameState.polypsReturnedWhenEating())
    const shrimpGoesToOpenSea = $derived(!gameSession.myPlayerState?.shrimpOnOpenSea)
</script>

<p class="prompt reef-display">Choose a coral for your parrotfish</p>
<p class="detail">
    {returned} polyp{returned === 1 ? '' : 's'} go{returned === 1 ? 'es' : ''} back in the bag, the rest
    to your parrotfish. Your shrimp
    {shrimpGoesToOpenSea ? 'goes onto the open sea' : 'is eaten too'}.
</p>
{#if gameSession.eatingStartsFinalTurns}
    <p class="warning">
        Your parrotfish's fourth shrimp: eating ends the game, and everyone else gets one final
        turn.
    </p>
{/if}
