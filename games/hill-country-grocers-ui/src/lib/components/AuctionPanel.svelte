<script lang="ts">
    import { AuctionKind } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import BidStepper from './BidStepper.svelte'
    import BigShareCertificate from './BigShareCertificate.svelte'

    const gameSession = getGameSession()

    const view = $derived(gameSession.auctionView)
    const cash = $derived(
        gameSession.myPlayerId
            ? gameSession.gameState.getPlayerState(gameSession.myPlayerId).cash
            : 0
    )
    const myBid = $derived(gameSession.bidding && view?.currentBidderId === gameSession.myPlayerId)
</script>

{#if view}
    <div class="auction">
        <div class="heading">
            {view.kind === AuctionKind.Initial ? 'Initial auction' : 'Share auction'}
        </div>
        <div class="table">
            <BigShareCertificate companyId={view.companyId} />
            <div class="seats">
                {#each view.seats as seat (seat.playerId)}
                    {@const current = seat.playerId === view.currentBidderId}
                    <div
                        class="seat"
                        class:passed={seat.passed}
                        class:current
                        style:--player={gameSession.colors.getPlayerUiColor(seat.playerId)}
                    >
                        <span class="name">{gameSession.displayName(seat.playerId)}</span>
                        <span class="amount"
                            >{seat.bid !== undefined ? `$${seat.bid}` : current ? '?' : '—'}</span
                        >
                        {#if seat.passed}
                            <span class="stamp">Passed</span>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
        {#if view.opening}
            <div class="controls">
                <BidStepper
                    minimum={view.minimumBid}
                    maximum={cash}
                    label="Bid"
                    onbid={(amount) => gameSession.openAuction(amount)}
                />
            </div>
        {/if}
        {#if myBid}
            <div class="controls">
                <BidStepper
                    minimum={view.minimumBid}
                    maximum={cash}
                    label="Bid"
                    onbid={(amount) => gameSession.placeBid(amount)}
                />
                {#if view.hasBid}
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
        font-size: 18px;
        font-weight: 700;
    }

    .table {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 16px;
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
