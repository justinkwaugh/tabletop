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
        auctioneerOf,
        tiedBidderIds,
        type ShopId
    } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AuctionBids from '$lib/components/AuctionBids.svelte'
    import { ordinal } from '$lib/utils/ordinal.js'
    import { movedVisitors, pulledInCustomers } from '$lib/utils/moneyReport.js'

    let { action }: { action: GameAction } = $props()
    const gameSession = getGameSession()

    function shopName(shopId: ShopId): string {
        return `the ${getShop(shopId).color} shop ${shopId}`
    }
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
    {@const auctioneerId = auctioneerOf(result)}
    <PlayerTag playerId={result.winnerId} /> bought {shopName(result.shopId)} for {result.price}{#if result.auctioneerCut > 0};
        <PlayerTag playerId={auctioneerId} /> took a {result.auctioneerCut} auctioneer's cut{/if}.
    <AuctionBids {result} separator=", " />.
    {#if tiedBidderIds(result).length > 0}
        <PlayerTag playerId={result.winnerId} /> won the tie, {result.winnerId === auctioneerId
            ? 'as the auctioneer'
            : 'sitting closer clockwise to the auctioneer'}.
    {/if}
    {@const walkIns = pulledInCustomers(result)}
    {#if walkIns.count > 0}
        {walkIns.count} customer{walkIns.count === 1 ? '' : 's'} walked in, paying {walkIns.income}.
    {/if}
{:else if isMoveVisitors(action)}
    moved {action.metadata ? movedVisitors(action.metadata) : 'visitors'}.
    {#each action.metadata?.entries ?? [] as entry (entry.shopId)}
        {entry.customers} entered {shopName(entry.shopId)}, paying
        <PlayerTag playerId={entry.ownerId} />
        {entry.income} Dirham{#if entry.moverCut > 0}, who paid a {entry.moverCut} Dirham cut{/if}.
    {/each}
{:else if isCompleteAntiqueSet(action) && action.metadata}
    <PlayerTag playerId={action.collectorId} /> completed the {ordinal(action.metadata.rank)} antique
    set and earned {action.metadata.payout} Dirham.
{:else if isBringVisitors(action)}
    brought {action.count} visitor{action.count === 1 ? '' : 's'} from the
    {action.end === QueueEnd.Front ? 'front' : 'back'} of the queue to an entrance.
{/if}
