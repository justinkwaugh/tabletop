<script lang="ts">
    import { choosingShare, shareButtons, shownRailroadCards } from '$lib/model/railroadCards.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'
    import ShareTrackMark from './ShareTrackMark.svelte'
    import SupplyCount from './SupplyCount.svelte'

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
     action area and the board, outside the scaling, centred in a row whose left end shows what the
     cubes are for, a share or track: its supply as a cube in its colour and the number left, with no
     name (the colour is the label); the seat cards beside the board
     show the shares. While the viewer takes a share each card is that share's button, the
     viewer's shares as dots; otherwise a press or hover spotlights it, and a press holds it, which
     narrows the building zoom. -->
<div class="frame max-sm:hidden" role="group" aria-label="Railroads">
    <ShareTrackMark />
    <div class="railroad-cards flex">
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
                        <SupplyCount railroadId={button.railroadId} supply={button.supply} />
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
        top: 3px;
        right: 3px;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
    }
</style>
