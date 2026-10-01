<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import {
        getShop,
        isBringVisitors,
        isCompleteAntiqueSet,
        isMoveVisitors,
        isPlaceBid,
        isResolveAuction,
        isStartAuction,
        QueueEnd,
        type ShopId
    } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { action }: { action: GameAction } = $props()
    const gameSession = getGameSession()

    function shopName(shopId: ShopId): string {
        return `the ${getShop(shopId).color} shop ${shopId}`
    }

    const Ordinals = ['first', 'second', 'third', 'fourth']
</script>

{#if isStartAuction(action)}
    started an auction for {shopName(action.shopId)}.
{:else if isPlaceBid(action)}
    {#if action.amount === undefined || action.playerId !== gameSession.myPlayer?.id}
        placed a sealed bid.
    {:else if action.amount === 0}
        passed.
    {:else}
        bid {action.amount} Dirham.
    {/if}
{:else if isResolveAuction(action) && action.metadata}
    {@const result = action.metadata}
    <PlayerTag playerId={result.winnerId} /> bought {shopName(result.shopId)} for {result.price}
    Dirham{#if result.auctioneerCut > 0}, and the auctioneer took a {result.auctioneerCut} Dirham cut{/if}.
    Bids:
    {#each result.bids as bid, index (bid.playerId)}
        {index > 0 ? ', ' : ''}<PlayerTag playerId={bid.playerId} />
        {bid.amount}
    {/each}.
    {#each result.pullIns as pullIn (pullIn.fountainId)}
        {pullIn.customers} customer{pullIn.customers === 1 ? '' : 's'} walked straight in from fountain
        {pullIn.fountainId}, paying {pullIn.income} Dirham.
    {/each}
{:else if isMoveVisitors(action)}
    moved the visitors at fountain {action.fountainId}{action.metadata
        ? ` to fountain ${action.metadata.destinationId}`
        : ''}.
    {#each action.metadata?.entries ?? [] as entry (entry.shopId)}
        {entry.customers} entered {shopName(entry.shopId)}, paying
        <PlayerTag playerId={entry.ownerId} />
        {entry.income} Dirham{#if entry.moverCut > 0}, who paid a {entry.moverCut} Dirham cut{/if}.
    {/each}
{:else if isCompleteAntiqueSet(action) && action.metadata}
    <PlayerTag playerId={action.collectorId} /> completed an antique set
    {Ordinals[action.metadata.rank]} and earned {action.metadata.payout} Dirham.
{:else if isBringVisitors(action)}
    brought {action.count} visitor{action.count === 1 ? '' : 's'} from the
    {action.end === QueueEnd.Front ? 'front' : 'back'} of the queue to fountain {action.entranceId}.
{/if}
