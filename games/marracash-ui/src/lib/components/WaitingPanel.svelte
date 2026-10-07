<script lang="ts">
    import type { Snippet } from 'svelte'
    import { ActionSource } from '@tabletop/common'
    import { getShop, isBringVisitors, isMoveVisitors } from '@tabletop/marracash'
    import BidSeals from '$lib/components/BidSeals.svelte'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import ActionDescription from '$lib/components/ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { latestTurnStep } from '$lib/utils/moneyReport.js'
    import { openBidders } from '$lib/utils/historyTurns.js'
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

    // A player's tag reads "You" when it is the viewer, so the verb after it agrees.
    function isVerb(playerId: string): string {
        return playerId === gameSession.myPlayer?.id ? 'are' : 'is'
    }

    let status = $derived(
        waitingStatus(gameSession.gameState, (playerId) => gameSession.visibleMoney(playerId))
    )
    let lastPlay = $derived(
        latestTurnStep(gameSession.shownActions).findLast(
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
        {#if status.auctioneerId}<PlayerTag playerId={status.auctioneerId} />{' '}{isVerb(
                status.auctioneerId
            )}{:else}is{/if} auctioning the
        <span
            class="swatch"
            style:background={gameSession.marketPalettes[color].fill}
            style:border-color={gameSession.marketPalettes[color].stroke}
        ></span>
        {color} shop.
    {:else if status.kind === 'refill'}
        <PlayerTag playerId={status.playerId} />
        {isVerb(status.playerId)} bringing new visitors to an emptied entrance.
    {:else if status.kind === 'turn' && status.options.length > 0}
        <PlayerTag playerId={status.playerId} />
        {isVerb(status.playerId)} choosing {choiceWords(status)}.
    {:else}
        Waiting for
        {#each status.kind === 'players' ? status.playerIds : [status.playerId] as playerId (playerId)}
            {' '}<PlayerTag {playerId} />
        {/each}
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
{#if lastPlay && status.kind !== 'bidding'}
    <p class="mt-1 text-sm"><ActionDescription action={lastPlay} /></p>
{/if}

<style>
    .swatch {
        display: inline-block;
        width: 0.8em;
        height: 0.8em;
        border: 1.5px solid;
        border-radius: 3px;
        vertical-align: -0.08em;
    }
</style>
