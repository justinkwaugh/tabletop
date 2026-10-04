<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import {
        getShop,
        isBringVisitors,
        isCompleteAntiqueSet,
        isConfirmTurn,
        isMoveVisitors,
        isPlaceBid,
        isResolveAuction,
        isStartAuction,
        QueueEnd,
        tiedBidderIds,
        type ShopId
    } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AuctionBids from '$lib/components/AuctionBids.svelte'
    import HistoryPayments from '$lib/components/HistoryPayments.svelte'
    import PawnGroup from '$lib/components/PawnGroup.svelte'
    import { ordinal } from '$lib/utils/ordinal.js'
    import { actionMoneyReport, movedVisitorColors, movedVisitors } from '$lib/utils/moneyReport.js'

    const MaxPawnsInSentence = 8

    let { action }: { action: GameAction } = $props()
    const gameSession = getGameSession()

    // The sentence already gives an auction's price, so its winning bid row is left out
    let payments = $derived(
        (actionMoneyReport(action)?.payments ?? []).filter(
            (payment) => payment.kind !== 'winningBid'
        )
    )
</script>

{#snippet shop(shopId: ShopId, article: 'a' | 'the')}
    {@const color = getShop(shopId).color}
    {article}
    <span class="font-semibold" style:color={gameSession.marketPalettes[color].fill}
        >{color} shop</span
    >
{/snippet}

{#if isStartAuction(action)}
    put {@render shop(action.shopId, 'a')} up for auction.
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
    <PlayerTag playerId={result.winnerId} /> bought {@render shop(result.shopId, 'the')} for {result.price}{#if tiedBidderIds(result).length > 0},
        winning the tie{/if}.
    <span class="mt-1 block"><AuctionBids {result} separator=", " /></span>
{:else if isMoveVisitors(action)}
    {@const colors = action.metadata ? movedVisitorColors(action.metadata) : []}
    moved
    {#if action.metadata && colors.length <= MaxPawnsInSentence}
        <span class="whitespace-nowrap"><PawnGroup {colors} />.</span>
    {:else}
        {action.metadata ? movedVisitors(action.metadata) : 'visitors'}.
    {/if}
{:else if isCompleteAntiqueSet(action) && action.metadata}
    <PlayerTag playerId={action.collectorId} /> completed the {ordinal(action.metadata.rank)} antique
    set.
{:else if isConfirmTurn(action)}
    confirmed their turn.
{:else if isBringVisitors(action)}
    brought
    {#if action.metadata}
        <PawnGroup colors={action.metadata.visitors} />
    {:else}
        {action.count} visitor{action.count === 1 ? '' : 's'}
    {/if}
    from the {action.end === QueueEnd.Front ? 'front' : 'back'} of the queue to an entrance.
{/if}
{#if payments.length > 0}
    <HistoryPayments {payments} />
{/if}
