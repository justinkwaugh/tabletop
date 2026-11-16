<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import { moneyKey, seatCardKey, shareSlotKey } from '$lib/animators/flights.svelte.js'
    import type { SeatCard } from '$lib/utils/seatCards.js'
    import RailroadPieceIcon from './board/RailroadPieceIcon.svelte'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'

    let { card, pendingGain }: { card: SeatCard; pendingGain: number | undefined } = $props()

    const gameSession = getGameSession()

    const name = $derived(gameSession.getPlayerName(card.playerId))
    const headerFill = $derived(gameSession.colors.getPlayerUiColor(card.playerId))

    function slotLabel(railroadId: RailroadId): string {
        const shares = card.rows.find((row) => row.railroadId === railroadId)?.shares ?? 0
        return `${railroadStyle(railroadId).name}: ${shares} share${shares === 1 ? '' : 's'}`
    }
</script>

<!-- Contract, Seat card: a paper card on the table, edged and marked in the seat's colour. -->
<section
    class="seat"
    class:acting={card.acting}
    aria-label={name}
    data-flight-target={seatCardKey(card.playerId)}
    style:--seat={headerFill}
>
    <header class="rtr-display">
        <span class="disc" aria-hidden="true"></span>
        <span class="name">{name}</span>
    </header>
    <div class="board">
        <!-- R-2.1, R-3.1: six share slots, one a round, filled in R-1.4 order; each held cube
             spotlights its railroad. -->
        <div class="slots" role="group" aria-label="Shares">
            {#each card.slots as railroadId, slot (slot)}
                <span class="slot" data-flight-target={shareSlotKey(card.playerId, slot)}>
                    {#if railroadId}
                        <RailroadSpotlightControl
                            {railroadId}
                            label={slotLabel(railroadId)}
                            class="held"
                        >
                            <RailroadPieceIcon {railroadId} size={18} />
                        </RailroadSpotlightControl>
                    {:else}
                        <span class="empty" aria-hidden="true"></span>
                    {/if}
                </span>
            {/each}
        </div>
        <div class="money" data-flight-target={moneyKey(card.playerId)}>
            <span class="rtr-display figure"
                >${gameSession.flights.shown(moneyKey(card.playerId), card.money)}</span
            >
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
        /* Name over shares on the left, money centred down the right, the same space all round. */
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 6px 10px;
        padding: 8px 10px;
    }

    /* Drawn inside the card, inside the seat colour's bar, so the side panel, which clips what
       overflows it, shows the whole ring. */
    .seat.acting {
        box-shadow: inset 0 0 0 3px var(--seat);
    }

    header {
        display: flex;
        align-items: center;
        grid-column: 1;
        gap: 8px;
        line-height: 1;
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

    .board {
        display: contents;
    }

    .slots {
        grid-column: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .slot {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .slots :global(.held) {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 4px;
    }

    .empty {
        width: 18px;
        height: 18px;
        border-radius: 3px;
        border: 1.5px dashed var(--rtr-line);
    }

    .money {
        grid-column: 2;
        grid-row: 1 / span 2;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        min-width: 64px;
        line-height: 1;
    }

    .figure {
        font-size: 28px;
        color: var(--rtr-ink);
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
