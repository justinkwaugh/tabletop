<script lang="ts">
    import { shownRailroadCards } from '$lib/model/railroadCards.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import SupplyPile from './board/SupplyPile.svelte'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    const cards = $derived(shownRailroadCards(gameSession))
</script>

<!-- Contract, Desktop layout: one card per railroad available this round (R-1.4), between the
     action area and the board, outside the scaling: its name and its supply pile, the cubes as
     large as the card holds; the seat cards beside the board show the shares. A press or hover
     spotlights it; a press holds it, which narrows the building zoom. -->
<div class="railroad-cards flex max-sm:hidden" role="group" aria-label="Railroads">
    {#each cards as card (card.railroadId)}
        {@const style = railroadStyle(card.railroadId)}
        <div
            class="slot"
            style:opacity={card.arriving ? 0 : undefined}
            use:flights.register={card.entryKey}
        >
            <RailroadSpotlightControl railroadId={card.railroadId} label={card.label} class="card">
                <span class="head rtr-serif" style:background={style.fill} style:color={style.ink}
                    >{style.name}</span
                >
                <span class="body">
                    <SupplyPile
                        railroadId={card.railroadId}
                        supply={card.supply}
                        arrangement="columns"
                    />
                </span>
            </RailroadSpotlightControl>
        </div>
    {/each}
</div>

<style>
    .railroad-cards {
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 3px;
    }

    .slot {
        flex: 1 1 0;
        min-width: 128px;
        max-width: 178px;
        display: flex;
    }

    .railroad-cards :global(.card) {
        flex: 1;
        min-width: 0;
        height: 64px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 8px;
        border: 1px solid var(--rtr-card-edge);
        background: var(--rtr-panel);
        color: var(--rtr-ink);
        text-align: left;
    }

    .head {
        flex: none;
        height: 14px;
        padding: 0 6px;
        font-size: 10px;
        line-height: 14px;
        white-space: nowrap;
    }

    .body {
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 6px 0 5px;
    }
</style>
