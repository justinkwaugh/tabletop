<script lang="ts">
    import type { TravelWay } from '$lib/model/actionOffers.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName } from '$lib/model/names.js'

    // R-7.1.4 Way Station's favor and R-11.12 the Buried Giant's flip are the player's to choose.
    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    function label(way: TravelWay): string {
        const parts = [way.cost > 0 ? `spend ${way.cost} Supply` : 'spend no Supply']
        for (const cardId of way.discountTolls) {
            parts.push(`give a favor to ${cardName(cardId)}'s ruler`)
        }
        if (way.flipSecret) parts.push('flip a secret facedown')
        return parts.join(', ')
    }
</script>

<div class="flex flex-col gap-1">
    <p class="text-xs text-stone-400">How do you pay for this Travel?</p>
    {#each gameSession.travelChoices as way, index (index)}
        <button
            class="rounded border border-amber-500/40 bg-stone-800/60 hover:border-amber-300 px-2 py-1 text-sm text-left first-letter:uppercase"
            disabled={busy}
            onclick={() => gameSession.chooseTravelWay(way)}
        >
            {label(way)}
        </button>
    {/each}
</div>
