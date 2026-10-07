<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { AuctionKind } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import BidStepper from './BidStepper.svelte'
    import CompanyBadge from './CompanyBadge.svelte'

    const gameSession = getGameSession()

    const auction = $derived(gameSession.gameState.auction)
    const bidding = $derived(auction ? gameSession.gameState.bidding() : undefined)
    const smallest = $derived(auction ? gameSession.gameState.smallestBid() : 0)
    const cash = $derived(
        gameSession.myPlayerId ? gameSession.gameState.getPlayerState(gameSession.myPlayerId).cash : 0
    )
    const myBid = $derived(gameSession.bidding && bidding?.currentBidderId === gameSession.myPlayerId)
</script>

{#if auction && bidding}
    <div class="auction">
        <div class="heading">
            <span>{auction.kind === AuctionKind.Initial ? 'Initial auction:' : 'Share auction:'}</span>
            <CompanyBadge companyId={auction.companyId} full />
        </div>
        <div class="terms">
            {#if bidding.hasBid}
                high bid <strong>${bidding.highBid}</strong> by <PlayerName playerId={bidding.highBidderId} />
            {:else}
                <PlayerName playerId={auction.bidding.auctioneerId} /> opens the bidding at any price
            {/if}
            · the winning bid goes to the company
        </div>
        <div class="bidders">
            {#each auction.bidding.participants as participant (participant.playerId)}
                <span
                    class="bidder"
                    class:passed={participant.passed}
                    class:current={participant.playerId === bidding.currentBidderId}
                >
                    <PlayerName playerId={participant.playerId} />
                    {#if participant.bid !== undefined}<span class="amount">${participant.bid}</span>{/if}
                </span>
            {/each}
        </div>
        {#if myBid}
            <div class="controls">
                <BidStepper
                    minimum={smallest}
                    maximum={cash}
                    label="Bid"
                    onbid={(amount) => gameSession.placeBid(amount)}
                />
                {#if bidding.hasBid}
                    <button type="button" class="secondary" onclick={() => gameSession.passBid()}
                        >Pass</button
                    >
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
    .auction {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }

    .heading {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 18px;
        font-weight: 700;
    }

    .terms {
        font-size: 16px;
        color: #7a4a2e;
        text-align: center;
    }

    .bidders {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }

    .bidder {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1.5px solid #d4b48c;
        border-radius: 999px;
        padding: 1px 9px;
        font-size: 15px;
    }

    .bidder.current {
        border-color: #c8961a;
        background: #fff1c2;
    }

    .bidder.passed {
        opacity: 0.45;
        text-decoration: line-through;
    }

    .amount {
        font-weight: 700;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
</style>
