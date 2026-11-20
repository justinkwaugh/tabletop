<script lang="ts">
    import { choosingShare, shareButtons, shownRailroadCards } from '$lib/model/railroadCards.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'
    import ShareButton from './ShareButton.svelte'
    import ShareTrackMark from './ShareTrackMark.svelte'
    import SupplyCount from './SupplyCount.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    const buttons = $derived(shareButtons(shownRailroadCards(gameSession), gameSession))
    const sharing = $derived(choosingShare(gameSession))
    // R-3.2.2: on the viewer's building turn, a railroad they hold no share of can't be built.
    const building = $derived(gameSession.building)
</script>

<!-- Contract, Desktop layout: one card per railroad available this round (R-1.4), between the
     action area and the board, outside the scaling, centred in a row whose left end shows what the
     cubes are for, a share or track: its supply as a cube in its colour and the number left, with no
     name (the colour is the label); the seat cards beside the board
     show the shares. While the viewer takes a share each card is that share's button, the
     viewer's shares as dots, which a mouse hover spotlights and a press takes; otherwise a press or
     hover spotlights it, and a press holds it, which
     narrows the building zoom. On the viewer's building turn a
     railroad they hold no share of is faded. -->
<div class="frame max-sm:hidden" role="group" aria-label="Railroads">
    <ShareTrackMark />
    <div class="railroad-cards flex">
        {#each buttons as button (button.railroadId)}
            <div
                class="slot"
                class:unheld={building && button.held === 0}
                style:opacity={button.arriving ? 0 : undefined}
                use:flights.register={button.entryKey}
            >
                {#if sharing}
                    <ShareButton {button} dots={false} />
                {:else}
                    <RailroadSpotlightControl
                        railroadId={button.railroadId}
                        label={button.label}
                        class="card"
                    >
                        <SupplyCount railroadId={button.railroadId} supply={button.supply} />
                    </RailroadSpotlightControl>
                {/if}
            </div>
        {/each}
    </div>
</div>

<style>
    .frame {
        margin-bottom: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 4px 0;
    }

    .railroad-cards {
        gap: 4px;
    }

    .slot {
        flex: 0 0 66px;
        display: flex;
    }

    .slot.unheld {
        opacity: 0.4;
    }

    .railroad-cards :global(.card) {
        position: relative;
        flex: 1;
        min-width: 0;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 6px;
        border: 1px solid var(--rtr-card-edge);
        background: var(--rtr-panel);
        color: var(--rtr-ink);
    }
</style>
