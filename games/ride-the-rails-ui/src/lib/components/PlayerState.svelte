<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ordinal } from '$lib/utils/marginTracks.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import type { SeatCard } from '$lib/utils/seatCards.js'
    import LocomotiveIcon from './board/LocomotiveIcon.svelte'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'

    let { card, pendingGain }: { card: SeatCard; pendingGain: number | undefined } = $props()

    const gameSession = getGameSession()

    const name = $derived(gameSession.getPlayerName(card.playerId))
    const headerFill = $derived(gameSession.colors.getPlayerUiColor(card.playerId))
    const headerInk = $derived(gameSession.colors.getPlayerTextColorValue(card.playerId))

    function rowLabel(railroadId: RailroadId, shares: number): string {
        return `${railroadStyle(railroadId).name}: ${shares} share${shares === 1 ? '' : 's'}`
    }
</script>

<!-- Contract, Seat card: a station departure board. -->
<section class="seat" class:acting={card.acting} aria-label="{name}, {ordinal(card.position)}">
    <header class="rtr-display" style:background={headerFill} style:color={headerInk}>
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
                    <LocomotiveIcon railroadId={row.railroadId} width={22} />
                    <span class="count">×{row.shares}</span>
                </RailroadSpotlightControl>
            {:else}
                <span class="none">No shares</span>
            {/each}
        </div>
        <div class="money">
            <span class="rtr-display figure">${card.money}</span>
            <span class="caption">Money</span>
            {#if pendingGain}
                <span class="pending" aria-label="Pending +${pendingGain}">+${pendingGain}</span>
            {/if}
        </div>
    </div>
</section>

<style>
    .seat {
        border-radius: 9px;
        overflow: hidden;
        border: 1px solid var(--rtr-halo);
        background: var(--rtr-departure);
        color: var(--rtr-departure-ink);
        text-align: left;
    }

    .seat.acting {
        box-shadow:
            0 0 0 3px var(--rtr-accent),
            0 0 0 4.5px var(--rtr-halo);
    }

    header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        padding: 2px 10px;
        letter-spacing: 0.02em;
    }

    .name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 20px;
    }

    .position {
        font-size: 15px;
        opacity: 0.85;
    }

    .board {
        display: flex;
        align-items: stretch;
        gap: 10px;
        padding: 6px 10px 8px;
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
        background: var(--rtr-departure-row);
        color: var(--rtr-departure-ink);
    }

    .count {
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1;
    }

    .none {
        align-self: center;
        font-size: 12px;
        color: var(--rtr-departure-muted);
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
        color: var(--rtr-departure-figure);
    }

    .caption {
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--rtr-departure-muted);
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
