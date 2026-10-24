<script lang="ts">
    import { DirectiveStatus } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { heldDirectiveIds } from '$lib/utils/directives.js'
    import DirectiveCard from './DirectiveCard.svelte'

    // The directives the viewer drew; tapping one keeps it (rulebook 5.1).
    const gameSession = getGameSession()
    const drawn = $derived(
        gameSession.myPlayerId
            ? heldDirectiveIds(gameSession.gameState, gameSession.myPlayerId, DirectiveStatus.Drawn)
            : []
    )
</script>

<div class="choice" role="group" aria-label="Directives drawn">
    {#each drawn as directiveId (directiveId)}
        {#if directiveId}
            <DirectiveCard {directiveId} onclick={() => gameSession.chooseDirective(directiveId)} />
        {/if}
    {/each}
</div>

<style>
    .choice {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
</style>
