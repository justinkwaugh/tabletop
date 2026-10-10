<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const returned = $derived(gameSession.gameState.polypsReturnedWhenEating())
</script>

<p class="prompt reef-display">Choose a coral for your parrotfish</p>
<p class="detail">
    {returned} of its polyps go back into the bag; the rest, and your shrimp on it, feed your parrotfish.
    Undo cancels.
</p>
