<script lang="ts">
    import { shownRailroadCards } from '$lib/model/railroadCards.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import SupplyPile from './board/SupplyPile.svelte'
    import SeatDot from './panel/SeatDot.svelte'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    const cards = $derived(shownRailroadCards(gameSession))
</script>

<!-- Contract, Phone layout: a rail down the board's right edge, outside the scaling, with one
     supply pile per railroad available this round (R-1.4), newest last. A press holds that
     railroad's spotlight and opens its track count and holders beside the pile; a second press
     closes both. -->
<div class="phone-rail flex sm:hidden" role="group" aria-label="Railroads">
    {#each cards as card, index (card.railroadId)}
        {@const style = railroadStyle(card.railroadId)}
        {@const open = gameSession.heldRailroadId === card.railroadId}
        <div
            class="slot"
            class:ruled={index > 0}
            style:opacity={card.arriving ? 0 : undefined}
            use:flights.register={card.entryKey}
        >
            <RailroadSpotlightControl railroadId={card.railroadId} label={card.label} class="pile">
                <SupplyPile railroadId={card.railroadId} supply={card.supply} arrangement="rows" />
            </RailroadSpotlightControl>
            {#if open}
                <div class="popover" role="note" aria-label="{style.name} railroad">
                    <span
                        class="head rtr-serif"
                        style:background={style.fill}
                        style:color={style.ink}>{style.name}</span
                    >
                    <span class="track">track <b>{card.trackCount}</b></span>
                    {#each card.shareholders as holding (holding.playerId)}
                        <span class="holder">
                            <SeatDot playerId={holding.playerId} />
                            {gameSession.getPlayerName(holding.playerId)}
                            <b>{holding.shares}</b>
                        </span>
                    {:else}
                        <span class="holder none">no shares</span>
                    {/each}
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .phone-rail {
        flex: none;
        width: 57px;
        align-self: stretch;
        flex-direction: column;
        padding: 4px 0;
        border: 1px solid var(--rtr-line);
        border-radius: 10px;
        background: var(--rtr-panel);
    }

    .slot {
        position: relative;
        display: flex;
        justify-content: center;
        padding: 2px 0;
    }

    .slot.ruled {
        margin-top: 4px;
        border-top: 1px solid var(--rtr-rule);
        padding-top: 6px;
    }

    .phone-rail :global(.pile) {
        display: flex;
        padding: 0 2px;
        border-radius: 6px;
    }

    .popover {
        position: absolute;
        top: 0;
        right: calc(100% + 8px);
        z-index: 30;
        min-width: 120px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 0 0 6px;
        overflow: hidden;
        border: 1px solid var(--rtr-card-edge);
        border-radius: 8px;
        background: var(--rtr-panel-raised);
        color: var(--rtr-ink);
        font-size: 12px;
        line-height: 1.2;
        white-space: nowrap;
    }

    .popover .head {
        padding: 1px 8px;
        font-size: 11px;
    }

    .popover .track,
    .popover .holder {
        padding: 0 8px;
    }

    .track {
        color: var(--rtr-ink-muted);
    }

    .track b {
        color: var(--rtr-ink);
    }

    .holder {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .holder.none {
        color: var(--rtr-ink-muted);
    }
</style>
