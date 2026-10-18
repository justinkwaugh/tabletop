<script lang="ts">
    import {
        INITIATIVE_PER_INFLUENCE,
        MAX_INITIATIVE_BID,
        maxInitiativeBid
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const most = $derived(maxInitiativeBid(gameSession.gameState, gameSession.myPlayerId ?? ''))
    const choices = $derived(Array.from({ length: most + 1 }, (_, influence) => influence))
</script>

<div class="sh-step">
    <p class="hint">
        Spend up to {MAX_INITIATIVE_BID} IP on your initiative roll, each adding {INITIATIVE_PER_INFLUENCE}%
        to it. Everyone declares at once; the rolls follow, and ties go to the better initiative
        before them.
    </p>
    <div class="row">
        {#each choices as influence (influence)}
            <button type="button" onclick={() => gameSession.declareInitiative(influence)}>
                {influence === 0
                    ? 'No IP'
                    : `${influence} IP · +${influence * INITIATIVE_PER_INFLUENCE}%`}
            </button>
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
