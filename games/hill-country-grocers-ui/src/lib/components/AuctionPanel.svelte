<script lang="ts">
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
        <div class="seats">
            {#each auction.bidding.participants as participant (participant.playerId)}
                {@const current = participant.playerId === bidding.currentBidderId}
                <div
                    class="seat"
                    class:passed={participant.passed}
                    class:current
                    style:--player={gameSession.colors.getPlayerUiColor(participant.playerId)}
                >
                    <span class="name"
                        >{participant.playerId === gameSession.myPlayerId
                            ? 'You'
                            : gameSession.getPlayerName(participant.playerId)}</span
                    >
                    <span class="amount"
                        >{participant.bid !== undefined
                            ? `$${participant.bid}`
                            : current
                              ? '?'
                              : '—'}</span
                    >
                    {#if participant.passed}
                        <span class="stamp">Passed</span>
                    {/if}
                </div>
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

    .seats {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
    }

    .seat {
        position: relative;
        display: flex;
        flex-direction: column;
        min-width: 96px;
        border: 1px solid #d4b48c;
        border-left: 14px solid var(--player);
        border-radius: 2px;
        background: #fffdf7;
        padding: 5px 8px 6px;
    }

    .seat.current {
        border: 2px solid #7a1d22;
        border-left: 14px solid var(--player);
        box-shadow: 0 2px 6px rgba(122, 29, 34, 0.3);
        transform: translateY(-3px);
    }

    .name {
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .amount {
        font-size: 22px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .seat.current .amount {
        color: #7a1d22;
    }

    .seat.passed > :not(.stamp) {
        opacity: 0.4;
    }

    .stamp {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-14deg);
        border: 2px solid #b0262e;
        border-radius: 2px;
        padding: 0 5px;
        color: #b0262e;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.85;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
</style>
