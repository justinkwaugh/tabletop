<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { industryName } from '$lib/utils/describeAction.js'
    import BidStepper from './BidStepper.svelte'
    import IndustryToken from './IndustryToken.svelte'

    const gameSession = getGameSession()

    const view = $derived(gameSession.industryAuctionView)
    const cash = $derived(
        gameSession.myPlayerId ? gameSession.gameState.getPlayerState(gameSession.myPlayerId).cash : 0
    )
</script>

{#if view}
    <div class="auction">
        <div class="heading">
            <IndustryToken industry={view.industry} size={26} />
            {industryName(view.industry)} token · level {view.minimum}
        </div>
        <p class="terms">
            Sealed bids: the highest bidder pays the second-highest bid. A bid is {gameSession.money(0)} or at least {gameSession.money(view.minimum)}.
        </p>
        <div class="seats">
            {#each view.seats as seat (seat.playerId)}
                <div
                    class="seat"
                    class:waiting={seat.waiting}
                    style:--player={gameSession.colors.getPlayerUiColor(seat.playerId)}
                >
                    <span class="name">{gameSession.displayName(seat.playerId)}</span>
                    <span class="amount">
                        {#if seat.waiting}
                            …
                        {:else if seat.amount !== undefined}
                            {gameSession.money(seat.amount)}
                        {:else if seat.sealed}
                            ✓
                        {:else}
                            —
                        {/if}
                    </span>
                </div>
            {/each}
        </div>
        {#if gameSession.sealedBidding}
            <div class="controls">
                <BidStepper
                    minimum={view.minimum}
                    maximum={cash}
                    label="Seal bid"
                    onbid={(amount) => gameSession.placeSealedBid(amount)}
                />
                {#if gameSession.mayBidZero}
                    <button type="button" class="secondary" onclick={() => gameSession.placeSealedBid(0)}
                        >Bid {gameSession.money(0)}</button
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
        align-items: center;
        gap: 8px;
        font-size: 18px;
        font-weight: 700;
    }

    .terms {
        margin: 0;
        font-size: 13px;
        color: #5b5a36;
        text-align: center;
    }

    .seats {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
    }

    .seat {
        display: flex;
        flex-direction: column;
        min-width: 92px;
        border: 1px solid #b9b48a;
        border-left: 14px solid var(--player);
        border-radius: 3px;
        background: #ece7c6;
        padding: 4px 8px 5px;
    }

    .seat.waiting {
        background: #fbf3c4;
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
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    @media (max-width: 639px) {
        .seat {
            min-width: 0;
            border-left-width: 8px;
            padding: 2px 5px 3px;
        }

        .amount {
            font-size: 16px;
        }
    }
</style>
