<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ordinal } from '$lib/utils/marginTracks.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import { moneyKey, seatCardKey } from '$lib/animators/flights.svelte.js'
    import type { SeatCard } from '$lib/utils/seatCards.js'
    import RailroadPieceIcon from './board/RailroadPieceIcon.svelte'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'

    let { card, pendingGain }: { card: SeatCard; pendingGain: number | undefined } = $props()

    const gameSession = getGameSession()

    const name = $derived(gameSession.getPlayerName(card.playerId))
    const headerFill = $derived(gameSession.colors.getPlayerUiColor(card.playerId))

    function rowLabel(railroadId: RailroadId, shares: number): string {
        return `${railroadStyle(railroadId).name}: ${shares} share${shares === 1 ? '' : 's'}`
    }
</script>

<!-- Contract, Seat card: a paper card on the table, edged and marked in the seat's colour. -->
<section
    class="seat"
    class:acting={card.acting}
    aria-label="{name}, {ordinal(card.position)}"
    data-flight-target={seatCardKey(card.playerId)}
    style:--seat={headerFill}
>
    <header class="rtr-display">
        <span class="disc" aria-hidden="true"></span>
        <span class="name">{name}</span>
        <span class="position">{ordinal(card.position)}</span>
    </header>
    <div class="board">
        <div class="rows">
            {#each card.rows as row (row.railroadId)}
                <RailroadSpotlightControl
                    railroadId={row.railroadId}
                    label={rowLabel(row.railroadId, row.shares)}
                    class="share-row"
                >
                    <RailroadPieceIcon railroadId={row.railroadId} size={18} />
                    <span class="count">×{row.shares}</span>
                </RailroadSpotlightControl>
            {:else}
                <span class="none">No shares</span>
            {/each}
        </div>
        <div class="money" data-flight-target={moneyKey(card.playerId)}>
            <span class="rtr-display figure"
                >${gameSession.flights.shown(moneyKey(card.playerId), card.money)}</span
            >
            <span class="caption">Money</span>
            {#if pendingGain}
                <span class="pending" aria-label="Pending +${pendingGain}">+${pendingGain}</span>
            {/if}
        </div>
    </div>
</section>

<style>
    .seat {
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid var(--rtr-card-edge);
        border-left: 6px solid var(--seat);
        background: var(--rtr-panel);
        color: var(--rtr-ink);
        text-align: left;
    }

    /* Drawn inside the card, inside the seat colour's bar, so the side panel, which clips what
       overflows it, shows the whole ring. */
    .seat.acting {
        box-shadow:
            inset 0 0 0 3px var(--rtr-accent),
            inset 0 0 0 4.5px var(--rtr-halo);
    }

    header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px 0;
        letter-spacing: 0.02em;
    }

    .disc {
        flex: none;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: var(--seat);
        box-shadow: 0 0 0 1px var(--rtr-halo);
    }

    .name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 20px;
    }

    .position {
        margin-left: auto;
        font-size: 15px;
        color: var(--rtr-ink-muted);
    }

    .board {
        display: flex;
        align-items: stretch;
        gap: 10px;
        padding: 4px 10px 8px;
    }

    .rows {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-wrap: wrap;
        align-content: center;
        gap: 4px 6px;
        min-height: 44px;
    }

    .rows :global(.share-row) {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 1px 6px 1px 3px;
        border-radius: 4px;
        border: 1px solid var(--rtr-line);
        background: var(--rtr-panel);
        color: var(--rtr-ink);
    }

    .count {
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1;
    }

    .none {
        align-self: center;
        font-size: 12px;
        color: var(--rtr-ink-muted);
    }

    .money {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        min-width: 64px;
        line-height: 1;
    }

    .figure {
        font-size: 34px;
        color: var(--rtr-ink);
    }

    .caption {
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--rtr-ink-muted);
    }

    .pending {
        margin-top: 4px;
        padding: 1px 8px;
        border-radius: 999px;
        border: 1px solid var(--rtr-line);
        background: var(--rtr-panel-raised);
        color: var(--rtr-ink);
        font-size: 12px;
        font-weight: 700;
    }
</style>
