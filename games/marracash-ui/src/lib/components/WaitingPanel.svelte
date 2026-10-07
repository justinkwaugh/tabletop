<script lang="ts">
    import type { Snippet } from 'svelte'
    import { ActionSource } from '@tabletop/common'
    import { getShop, isBringVisitors, isMoveVisitors } from '@tabletop/marracash'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import StepDescription from '$lib/components/StepDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { latestTurnStep } from '$lib/utils/moneyReport.js'
    import { waitingStatus, type TurnOption } from '$lib/utils/waitingStatus.js'

    function choiceWords({
        options,
        secondAction
    }: {
        options: TurnOption[]
        secondAction: boolean
    }): string {
        if (options.length > 1) {
            return `${secondAction ? 'a second action' : 'an action'}: move visitors or put a shop up for auction`
        }
        return options[0] === 'move' ? 'visitors to move' : 'a shop to put up for auction'
    }

    let { lead }: { lead?: Snippet } = $props()
    const gameSession = getGameSession()

    let status = $derived(
        waitingStatus(gameSession.gameState, (playerId) => gameSession.visibleMoney(playerId))
    )
    let lastPlay = $derived(
        latestTurnStep(gameSession.shownActions).filter(
            (action) =>
                action.source === ActionSource.User &&
                (isMoveVisitors(action) || isBringVisitors(action))
        )
    )
</script>

<p class="marracash-prompt">
    {@render lead?.()}
    {#if status.kind === 'bidding'}
        {@const color = getShop(status.shopId).color}
        {#if status.auctioneerId}<PlayerTag playerId={status.auctioneerId} />{' '}{/if}put the
        <span style:color={gameSession.marketPalettes[color].stroke}>{color} shop</span> up for
        auction.
        {#if status.awaitingIds.length === 0}
            All bids are in.
        {:else}
            Still to bid:
            {#each status.awaitingIds as playerId (playerId)}
                {' '}<PlayerTag {playerId} />
            {/each}
        {/if}
    {:else if status.kind === 'refill'}
        <PlayerTag playerId={status.playerId} /> is bringing new visitors to an emptied entrance.
    {:else if status.kind === 'turn' && status.options.length > 0}
        <PlayerTag playerId={status.playerId} /> is choosing {choiceWords(status)}.
    {:else}
        Waiting for
        {#each status.kind === 'players' ? status.playerIds : [status.playerId] as playerId (playerId)}
            {' '}<PlayerTag {playerId} />
        {/each}
    {/if}
</p>
{#if lastPlay.length > 0 && status.kind !== 'bidding'}
    <p class="mt-1 text-sm"><StepDescription actions={lastPlay} /></p>
{/if}
