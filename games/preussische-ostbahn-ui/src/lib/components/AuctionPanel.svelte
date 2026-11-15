<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { assertExists } from '@tabletop/common'
    import { cubesLeft, railroadIncome } from '@tabletop/preussische-ostbahn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RailroadBadge from './RailroadBadge.svelte'
    import BidStepper from './BidStepper.svelte'
    import PanelSummary from './PanelSummary.svelte'

    const ORDINALS = ['1st', '2nd', '3rd']

    function ordinal(n: number): string {
        const word = ORDINALS[n - 1]
        assertExists(word, `A railroad has no share number ${n}`)
        return word
    }

    const gameSession = getGameSession()
    const view = $derived(gameSession.shareAuctionView)
    const myCash = $derived(
        gameSession.myPlayerId
            ? gameSession.gameState.getPlayerState(gameSession.myPlayerId).cash
            : 0
    )

    function status(playerId: string, passed: boolean): string {
        if (passed) return 'Passed'
        if (playerId === view?.highBidderId) return 'High bid'
        if (playerId === view?.currentBidderId) return 'To bid'
        return ''
    }
</script>

{#if view}
    {@const railroad = gameSession.gameState.railroad(view.railroadId)}
    <div class="auction">
        <PanelSummary
            facts={[
                `Income $${railroadIncome(railroad)}`,
                `Treasury $${railroad.treasury}`,
                `${cubesLeft(railroad)} track left`
            ]}
        >
            {#snippet heading()}
                Auctioning {ordinal(railroad.owners.length + 1)} share of
                <RailroadBadge railroadId={view.railroadId} />
            {/snippet}
        </PanelSummary>
        <ol class="bids" style:--seats={view.seats.length}>
            {#each view.seats as seat (seat.playerId)}
                <li
                    class="bid"
                    class:high={seat.playerId === view.highBidderId}
                    class:current={seat.playerId === view.currentBidderId}
                    class:passed={seat.passed}
                >
                    <span
                        class="name"
                        style:background={gameSession.colors.getPlayerUiColor(seat.playerId)}
                        style:color={gameSession.colors.getPlayerTextColorValue(seat.playerId)}
                        ><PlayerName playerId={seat.playerId} /></span
                    >
                    <span class="amount">{seat.bid === undefined ? '–' : `$${seat.bid}`}</span>
                    <span class="status">{status(seat.playerId, seat.passed)}</span>
                </li>
            {/each}
        </ol>
        {#if gameSession.bidding}
            <div class="controls">
                {#if myCash >= view.smallestBid}
                    <BidStepper
                        minimum={view.smallestBid}
                        maximum={myCash}
                        onbid={(amount) => gameSession.placeBid(amount)}
                    />
                {/if}
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
        gap: 8px;
        width: 100%;
    }

    .bids {
        display: grid;
        grid-template-columns: repeat(var(--seats), minmax(0, 1fr));
        gap: 6px;
        width: min(100%, calc(var(--seats) * 112px));
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .bid {
        display: flex;
        flex-direction: column;
        min-width: 0;
        border: 2px solid var(--po-rule);
        border-radius: 4px;
        background: var(--po-paper);
        overflow: hidden;
    }

    .bid.current {
        border-style: dashed;
        border-color: var(--po-accent);
    }

    .bid.high {
        border-color: var(--po-accent);
    }

    .bid.passed {
        opacity: 0.45;
    }

    .name {
        overflow: hidden;
        border-bottom: 1px solid var(--po-rule);
        padding: 2px 6px;
        font-size: 13px;
        font-weight: 700;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .amount {
        padding-top: 2px;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.2;
        font-variant-numeric: lining-nums tabular-nums;
    }

    .status {
        min-height: 1.3em;
        padding-bottom: 2px;
        color: var(--po-muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .bid.high .status,
    .bid.current .status {
        color: var(--po-accent);
        font-weight: 700;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }

    @media (max-width: 639px) {
        .bids {
            gap: 4px;
        }

        .name {
            padding: 1px 4px;
            font-size: 12px;
        }

        .amount {
            font-size: 17px;
        }

        .status {
            font-size: 9.5px;
            letter-spacing: 0.02em;
        }
    }
</style>
