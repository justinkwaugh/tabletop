<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ClaimMedallion from './ClaimMedallion.svelte'

    /** `size`: the medallion's width on screen, in px. */
    let { size }: { size: number } = $props()

    const gameSession = getGameSession()

    const claim = $derived(gameSession.gameState.transcontinental)
</script>

<!-- R-4.3.3: the claim's gold medallion with its amount, or a dashed gold ring while
     the line is unclaimed. The chip that holds it names it. -->
<ClaimMedallion {size} amount={claim?.amount} />
