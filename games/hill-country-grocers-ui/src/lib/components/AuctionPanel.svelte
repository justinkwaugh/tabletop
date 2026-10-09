<script lang="ts">
    import type { AuctionParticipant } from '@tabletop/common'
    import { AuctionKind, seatOrderFrom } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import BidStepper from './BidStepper.svelte'
    import BigShareCertificate from './BigShareCertificate.svelte'

    const gameSession = getGameSession()

    const auction = $derived(gameSession.gameState.auction)
    const bidding = $derived(auction ? gameSession.gameState.bidding() : undefined)
    const opening = $derived(!auction && gameSession.auctionCompany !== undefined)
    const companyId = $derived(auction?.companyId ?? gameSession.auctionCompany)
    const kind = $derived(auction?.kind ?? AuctionKind.Share)
    const seats: AuctionParticipant[] = $derived(
        auction
            ? auction.bidding.participants
            : gameSession.myPlayerId
              ? seatOrderFrom(gameSession.gameState.turnManager.turnOrder, gameSession.myPlayerId).map(
                    (playerId) => ({ playerId, passed: false })
                )
              : []
    )
    const currentBidderId = $derived(bidding ? bidding.currentBidderId : gameSession.myPlayerId)
    const smallest = $derived(auction ? gameSession.gameState.smallestBid() : 0)
    const cash = $derived(
        gameSession.myPlayerId ? gameSession.gameState.getPlayerState(gameSession.myPlayerId).cash : 0
    )
    const myBid = $derived(gameSession.bidding && bidding?.currentBidderId === gameSession.myPlayerId)
</script>

{#if companyId && (bidding || opening)}
    <div class="auction">
        <div class="heading">{kind === AuctionKind.Initial ? 'Initial auction' : 'Share auction'}</div>
        <div class="table">
            <BigShareCertificate {companyId} />
            <div class="seats">
                {#each seats as seat (seat.playerId)}
                    {@const current = seat.playerId === currentBidderId}
                    <div
                        class="seat"
                        class:passed={seat.passed}
                        class:current
                        style:--player={gameSession.colors.getPlayerUiColor(seat.playerId)}
                    >
                        <span class="name"
                            >{seat.playerId === gameSession.myPlayerId
                                ? 'You'
                                : gameSession.getPlayerName(seat.playerId)}</span
                        >
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
        {#if opening}
            <div class="controls">
                <BidStepper
                    minimum={0}
                    maximum={cash}
                    label="Bid"
                    onbid={(amount) => gameSession.openAuction(amount)}
                />
            </div>
        {/if}
        {#if myBid}
            <div class="controls">
                <BidStepper
                    minimum={smallest}
                    maximum={cash}
                    label="Bid"
                    onbid={(amount) => gameSession.placeBid(amount)}
                />
                {#if bidding?.hasBid}
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
