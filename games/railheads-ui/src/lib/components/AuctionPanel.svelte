<script lang="ts">
    import { ShareAuctionKind } from '@tabletop/railheads'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import BidStepper from './BidStepper.svelte'
    import CompanyBadge from './CompanyBadge.svelte'
    import IndustryToken from './IndustryToken.svelte'
    import ShareCertificate from './ShareCertificate.svelte'
    import Stamp from './Stamp.svelte'

    const gameSession = getGameSession()

    const view = $derived(gameSession.shareAuctionView)
    const cash = $derived(
        gameSession.myPlayerId ? gameSession.gameState.getPlayerState(gameSession.myPlayerId).cash : 0
    )
    const myBid = $derived(gameSession.bidding && view?.currentBidderId === gameSession.myPlayerId)
</script>

{#if view}
    <div class="auction">
        <div class="lot">
            <div class="heading">
                {view.kind === ShareAuctionKind.Initial ? 'Initial auction' : 'Share on offer'}
            </div>
            <div class="items">
                <CompanyBadge companyId={view.companyId} />
                {#if view.industry}
                    <IndustryToken industry={view.industry} size={24} labelled />
                {/if}
                {#if view.startPlayer}<span class="start">+ Start Player token</span>{/if}
            </div>
        </div>
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
                    {#if seat.passed}<Stamp label="Passed" />{/if}
                </div>
            {/each}
        </div>
        <div class="terms">
            Minimum bid ${view.minimum}
            {#if view.kind === ShareAuctionKind.Initial && view.openerId}
                · unbid, it goes free to <PlayerName
                    playerId={view.openerId}
                    capitalization={view.openerId === gameSession.myPlayerId ? 'none' : 'capitalize'}
                />
            {/if}
        </div>
        {#if view.upcoming.length > 0}
            <div class="upcoming" role="group" aria-label="Opening shares still to come">
                <span class="label">Up next</span>
                {#each view.upcoming as offer (offer.companyId)}
                    <ShareCertificate companyId={offer.companyId} />
                    {#if offer.industry}<IndustryToken industry={offer.industry} size={16} />{/if}
                {/each}
            </div>
        {/if}
        {#if myBid}
            <div class="controls">
                <BidStepper
                    minimum={view.smallestBid}
                    maximum={cash}
                    label="Bid"
                    onbid={(amount) => gameSession.placeBid(amount)}
                />
                <button type="button" class="secondary" onclick={() => gameSession.passBid()}
                    >Pass</button
                >
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

    .lot {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px 12px;
    }

    .heading {
        font-size: 18px;
        font-weight: 700;
    }

    .items {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
    }

    .start {
        font-size: 13px;
        font-style: italic;
        color: #5b5a36;
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
        min-width: 92px;
        border: 1px solid #b9b48a;
        border-left: 14px solid var(--player);
        border-radius: 3px;
        background: #ece7c6;
        padding: 4px 8px 5px;
    }

    .seat.current {
        border: 2px solid #9a7d12;
        border-left: 14px solid var(--player);
        background: #fbf3c4;
        box-shadow: 0 2px 6px rgba(30, 36, 10, 0.3);
        transform: translateY(-3px);
    }

    .name {
        font-family: 'Railheads Baskerville', Georgia, serif;
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

    .seat.passed .name,
    .seat.passed .amount {
        opacity: 0.4;
    }

    .terms {
        font-size: 13px;
        color: #5b5a36;
        text-align: center;
    }

    .upcoming {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }

    .label {
        margin-right: 2px;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #5b5a36;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    @media (max-width: 639px) {
        .heading {
            font-size: 15px;
        }

        .seats {
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
        }

        .amount {
            font-size: 16px;
        }
    }
</style>
