<script lang="ts">
    import { ActionSource } from '@tabletop/common'
    import { isCompleteAntiqueSet, isResolveAuction } from '@tabletop/marracash'
    import ActionDescription from '$lib/components/ActionDescription.svelte'
    import BidSeals from '$lib/components/BidSeals.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { openBidders } from '$lib/utils/historyTurns.js'
    import { viewedHistoryStep } from '$lib/utils/moneyReport.js'

    const gameSession = getGameSession()

    // A step is its player action, but the state shown also holds what the game resolved just
    // before it (an auction or an antique set), so that comes first, quietly, on its own line.
    let step = $derived(viewedHistoryStep(gameSession.shownActions))
    let played = $derived(step.findLast((action) => action.source === ActionSource.User))
    let resolved = $derived(
        step.filter((action) => isResolveAuction(action) || isCompleteAntiqueSet(action))
    )
</script>

{#if resolved.length > 0}
    <p class="resolved">
        {#each resolved as action (action.id)}
            <ActionDescription {action} />{' '}
        {/each}
    </p>
{/if}
<p class="marracash-prompt">
    {#if played}
        <ActionDescription action={played} />
    {:else}
        The market opens.
    {/if}
</p>
{#if gameSession.gameState.auction}
    <div class="mt-1.5 flex justify-center text-sm">
        <BidSeals
            bidders={openBidders(gameSession.gameState.auction)}
            signHeight={18}
            spread={false}
        />
    </div>
{/if}

<style>
    .resolved {
        margin-bottom: 2px;
        font-size: 0.875rem;
        color: #6e6252;
    }
</style>
