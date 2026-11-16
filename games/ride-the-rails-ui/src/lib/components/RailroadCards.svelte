<script lang="ts">
    import { choosingShare, shareButtons, shownRailroadCards } from '$lib/model/railroadCards.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CARD_PILE_UNIT } from '$lib/utils/supplyPile.js'
    import SupplyPile from './board/SupplyPile.svelte'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    const buttons = $derived(shareButtons(shownRailroadCards(gameSession), gameSession))
    const sharing = $derived(choosingShare(gameSession))
    const dotColour = $derived(
        gameSession.myPlayerId
            ? gameSession.colors.getPlayerBgColorValue(gameSession.myPlayerId)
            : undefined
    )
</script>

<!-- Contract, Desktop layout: one card per railroad available this round (R-1.4), between the
     action area and the board, outside the scaling: its supply pile alone, with no name (the
     colour is the label), the cubes as large as the card holds; the seat cards beside the board
     show the shares. While the viewer takes a share each card is that share's button, the
     viewer's shares as dots; otherwise a press or hover spotlights it, and a press holds it, which
     narrows the building zoom. -->
<div class="railroad-cards flex max-sm:hidden" role="group" aria-label="Railroads">
    {#each buttons as button (button.railroadId)}
        <div
            class="slot"
            style:opacity={button.arriving ? 0 : undefined}
            use:flights.register={button.entryKey}
        >
            {#if sharing}
                <button
                    type="button"
                    class="card share hover:enabled:border-rtr-accent focus-visible:outline-2 focus-visible:outline-rtr-accent"
                    class:empty={button.supply === 0}
                    disabled={!button.enabled}
                    aria-label={button.shareLabel}
                    onclick={() => gameSession.takeShare(button.railroadId)}
                >
                    <SupplyPile
                        railroadId={button.railroadId}
                        supply={button.supply}
                        fit="fixed"
                        unit={CARD_PILE_UNIT}
                    />
                    {#if button.held > 0}
                        <span class="dots">
                            {#each { length: button.held }, index (index)}
                                <span class="dot" style:background-color={dotColour}></span>
                            {/each}
                        </span>
                    {/if}
                </button>
            {:else}
                <RailroadSpotlightControl
                    railroadId={button.railroadId}
                    label={button.label}
                    class="card"
                >
                    <SupplyPile
                        railroadId={button.railroadId}
                        supply={button.supply}
                        fit="fixed"
                        unit={CARD_PILE_UNIT}
                    />
                </RailroadSpotlightControl>
            {/if}
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
        position: relative;
        flex: 1;
        min-width: 0;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 8px;
        border: 1px solid var(--rtr-card-edge);
        background: var(--rtr-panel);
        color: var(--rtr-ink);
    }

    .railroad-cards .share {
        border: 1.5px solid var(--rtr-line);
        background: var(--rtr-panel-raised);
        box-shadow: 0 2px 0 var(--rtr-line);
    }

    .share:disabled {
        opacity: 0.55;
    }

    .railroad-cards .share.empty {
        border-style: dashed;
        box-shadow: none;
    }

    .dots {
        position: absolute;
        top: 5px;
        right: 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
    }
</style>
