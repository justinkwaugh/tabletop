<script lang="ts">
    import { AuctionKind } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import BidStepper from './BidStepper.svelte'
    import BigShareCertificate from './BigShareCertificate.svelte'
    import ShareCertificate from './ShareCertificate.svelte'
    import Stamp from './Stamp.svelte'

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
        <div class="table">
            <div class="heading">
                {view.kind === AuctionKind.Initial ? 'Initial auction' : 'Share auction'}
            </div>
            <BigShareCertificate companyId={view.companyId} shrinkOnPhone />
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
                            <Stamp label="Passed" />
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
        {#if view.upcomingInitialAuctions.length > 0}
            <div class="upcoming" role="group" aria-label="Initial auctions still to come">
                <span class="upcoming-label">Up next</span>
                {#each view.upcomingInitialAuctions as companyId (companyId)}
                    <ShareCertificate {companyId} />
                {/each}
            </div>
        {/if}
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
        flex-basis: 100%;
        font-size: 18px;
        font-weight: 700;
        text-align: center;
    }

    .table {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px 16px;
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

    .seat.passed .name,
    .seat.passed .amount {
        opacity: 0.4;
    }

    .upcoming {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .upcoming-label {
        margin-right: 2px;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #7a5a40;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    @media (max-width: 639px) {
        .table {
            column-gap: 8px;
        }

        .heading {
            flex-basis: auto;
            font-size: 16px;
        }

        .seats {
            flex-basis: 100%;
            gap: 4px;
        }

        .seat,
        .seat.current {
            --stamp-size: 11px;
            min-width: 0;
            border-left-width: 8px;
            padding: 2px 5px 3px;
        }

        .name {
            font-size: 10px;
            letter-spacing: 0.02em;
        }

        .amount {
            font-size: 16px;
        }

        .controls {
            gap: 6px;
        }

        .secondary {
            padding: 0.25rem 0.7rem;
        }
    }
</style>
