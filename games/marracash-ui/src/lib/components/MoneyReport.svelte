<script lang="ts">
    import { getShop, tiedBidderIds, type MarketColor, type ShopId } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import AuctionBids from '$lib/components/AuctionBids.svelte'
    import { ordinal } from '$lib/utils/ordinal.js'
    import {
        movedVisitors,
        signedAmount,
        type MoneyReport,
        type Payment
    } from '$lib/utils/moneyReport.js'

    let { reports }: { reports: MoneyReport[] } = $props()

    const gameSession = getGameSession()

    function shopColor(shopId: ShopId): MarketColor {
        return getShop(shopId).color
    }
</script>

{#snippet headline(report: MoneyReport)}
    {#if report.kind === 'auction'}
        {@const color = shopColor(report.result.shopId)}
        <PlayerTag playerId={report.result.winnerId} /> bought the
        <span style:color={gameSession.marketPalettes[color].stroke}>{color} shop</span>
        for {report.result.price}.
    {:else if report.kind === 'move'}
        <PlayerTag playerId={report.moverId} /> moved {movedVisitors(report.result)}.
    {:else}
        <PlayerTag playerId={report.collectorId} /> completed the {ordinal(report.result.rank)} antique
        set.
    {/if}
{/snippet}

{#snippet reason(payment: Payment)}
    {#if payment.kind === 'winningBid'}
        winning bid
    {:else if payment.kind === 'auctioneerCut'}
        auctioneer's cut
    {:else if payment.kind === 'customers'}
        {#each Array.from({ length: payment.count }) as _, index (index)}<PawnIcon
                color={payment.color}
            />{/each}
        {payment.count} customer{payment.count === 1 ? '' : 's'}{#if payment.walkedIn}
            walked in{/if}
    {:else if payment.kind === 'moverCut'}
        <span class="text-[#7a6650]">→</span>
        <PlayerTag playerId={payment.toPlayerId} /> mover's cut
    {:else}
        best {payment.cardCount} cards
    {/if}
{/snippet}

<div class="mb-2 flex flex-col items-center gap-1 border-b border-[#d9c7a3] pb-2">
    {#each reports as report, index (index)}
        <p class="font-semibold">{@render headline(report)}</p>
        <div
            class="grid grid-cols-[auto_auto_auto] items-center gap-x-2.5 gap-y-1 text-left text-sm"
        >
            {#each report.payments as payment, paymentIndex (paymentIndex)}
                <PlayerTag playerId={payment.playerId} />
                <span
                    class="marracash-display text-right"
                    class:text-[#2e6b34]={payment.amount > 0}
                    class:text-[#9b2c2c]={payment.amount < 0}>{signedAmount(payment.amount)}</span
                >
                <span class="whitespace-nowrap">{@render reason(payment)}</span>
            {/each}
        </div>
        {#if report.kind === 'auction'}
            <!-- Phones keep the report short; History still lists every bid -->
            <p class="text-sm max-sm:hidden">
                <AuctionBids result={report.result} separator=" · " />
            </p>
            {#if tiedBidderIds(report.result).length > 0}
                <p class="text-sm font-semibold">
                    <PlayerTag playerId={report.result.winnerId} /> wins the tie.
                </p>
            {/if}
        {/if}
    {/each}
</div>
