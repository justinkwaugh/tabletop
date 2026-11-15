<script lang="ts">
    import { shownRailroadCards } from '$lib/model/railroadCards.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import { seatInitials } from '$lib/utils/seatCards.js'
    import SupplyPile from './board/SupplyPile.svelte'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    const cards = $derived(shownRailroadCards(gameSession))
    const initials = $derived(
        seatInitials(
            gameSession.game.players.map((player) => ({ playerId: player.id, name: player.name }))
        )
    )
</script>

<!-- Contract, Desktop layout: one card per railroad available this round (R-1.4), between the
     action area and the board, outside the scaling: its name, its supply pile, its track and its
     holders. A press or hover spotlights it; a press holds it, which narrows the building zoom. -->
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
                    <span class="meta">
                        <span class="track">track <b>{card.trackCount}</b></span>
                        <span class="holders">
                            {#each card.shareholders as holding (holding.playerId)}
                                <span class="holder">
                                    <span
                                        class="disc"
                                        style:background={gameSession.colors.getPlayerUiColor(
                                            holding.playerId
                                        )}
                                        style:color={gameSession.colors.getPlayerTextColorValue(
                                            holding.playerId
                                        )}>{(initials.get(holding.playerId) ?? '').charAt(0)}</span
                                    >{holding.shares}
                                </span>
                            {/each}
                        </span>
                    </span>
                </span>
            </RailroadSpotlightControl>
        </div>
    {/each}
</div>

<style>
    .railroad-cards {
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 6px;
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
        gap: 6px;
        padding: 0 6px 0 5px;
    }

    .meta {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .track {
        font-size: 11px;
        line-height: 1;
        color: var(--rtr-ink-muted);
    }

    .track b {
        font-size: 12px;
        color: var(--rtr-ink);
    }

    .holders {
        display: flex;
        flex-wrap: wrap;
        gap: 1px 4px;
    }

    .holder {
        display: inline-flex;
        align-items: center;
        gap: 1px;
        font-size: 11px;
        font-weight: 700;
        line-height: 13px;
    }

    .disc {
        display: inline-grid;
        place-items: center;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        border: 1px solid var(--rtr-ink);
        font-size: 8px;
        line-height: 1;
    }
</style>
