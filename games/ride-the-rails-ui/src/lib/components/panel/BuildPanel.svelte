<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        buildProgress,
        buildableRailroads,
        endBuildingLabel,
        mountainNote,
        placedText
    } from '$lib/model/actionArea.js'
    import { isInFullScreen } from '$lib/model/fullScreenContext.js'
    import { shownRailroadCards } from '$lib/model/railroadCards.js'
    import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
    import MarkPill from '../board/MarkPill.svelte'
    import SupplyCount from '../SupplyCount.svelte'
    import RailroadSpotlightControl from '../RailroadSpotlightControl.svelte'

    const gameSession = getGameSession()
    // Full screen's dialog leaves the railroad cards, and so their spotlight, out of reach: there
    // the panel is the phone's one line, with the piles, at every width.
    const inFullScreen = isInFullScreen()
    const oneLine = $derived(isPhoneWidth() || inFullScreen)

    // R-3.2.1, R-3.2.3, R-3.2.4
    const progress = $derived(buildProgress(gameSession.gameState))
    const note = $derived(progress && mountainNote(progress))

    // R-3.2, R-4.1, R-4.2: on a phone, a card for each of the railroads the building seat may place now,
    // the same set that lights the hexes; a railroad that empties or has no legal hex drops out.
    const piles = $derived.by(() => {
        const playerId = gameSession.myPlayerId
        if (!progress || !playerId || !oneLine) return []
        const buildable = buildableRailroads(gameSession.gameState, playerId)
        return shownRailroadCards(gameSession).filter((card) => buildable.includes(card.railroadId))
    })
</script>

{#if progress && oneLine}
    <!-- Contract, Build: on a phone and in full screen, the count, the mountain's −1 and the
         button on one line, and below them a card for each railroad the seat may place now, its
         supply as a cube and the number left; a press spotlights it. -->
    <div class="flex items-center justify-center gap-2.5">
        <span class="rtr-display text-[22px] leading-none" aria-hidden="true"
            >{progress.placed} / {progress.limit}</span
        >
        <span class="sr-only">{placedText(progress)}{note ? `, ${note}` : ''}</span>
        {#if note}<MarkPill tone="cost" text="−1" />{/if}
        <button
            type="button"
            class="h-8 shrink-0 rounded-full border-2 border-rtr-pill bg-rtr-pill px-3.5 text-sm font-semibold whitespace-nowrap text-rtr-pill-ink hover:enabled:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rtr-accent disabled:opacity-50"
            disabled={!gameSession.building}
            onclick={() => gameSession.endBuilding()}>{endBuildingLabel(progress)}</button
        >
    </div>
    {#if piles.length > 0}
        <div class="cards" role="group" aria-label="Railroads">
            {#each piles as card (card.railroadId)}
                <div class="slot">
                    <RailroadSpotlightControl
                        railroadId={card.railroadId}
                        label={card.label}
                        class="build-card"
                    >
                        <SupplyCount railroadId={card.railroadId} supply={card.supply} />
                    </RailroadSpotlightControl>
                </div>
            {/each}
        </div>
    {/if}
{:else if progress}
    <h2 class="text-base font-bold">Choose spaces on the map to build track</h2>
    <!-- The count and the mountain's −1 on the next line, beside the button. -->
    <div class="mt-1.5 flex flex-wrap items-center gap-2.5">
        <span class="rtr-display text-[26px] leading-none"
            >{progress.placed} / {progress.limit}<span class="sr-only"
                >, {placedText(progress)}</span
            ></span
        >
        {#if note}
            <MarkPill tone="cost" text="−1" />
            <span class="sr-only">{note}</span>
        {/if}
        <button
            type="button"
            class="rounded-full border-2 border-rtr-pill bg-rtr-pill px-3.5 py-1 text-sm font-semibold text-rtr-pill-ink hover:enabled:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rtr-accent disabled:opacity-50"
            disabled={!gameSession.building}
            onclick={() => gameSession.endBuilding()}>{endBuildingLabel(progress)}</button
        >
    </div>
{/if}

<style>
    .cards {
        display: flex;
        justify-content: center;
        gap: 4px;
        margin-top: 6px;
    }

    /* The desktop cards' width, narrowing when six railroads would not fit a phone's row. */
    .slot {
        flex: 0 1 66px;
        min-width: 0;
        display: flex;
    }

    .cards :global(.build-card) {
        flex: 1;
        min-width: 0;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 6px;
        border: 1px solid var(--rtr-card-edge);
        background: var(--rtr-panel-raised);
        color: var(--rtr-ink);
        container-type: inline-size;
    }

    /* As the share buttons: a smaller cube and figure in a narrow card. */
    @container (max-width: 44px) {
        .cards :global(.supply) {
            --supply-cube: 10px;
            --supply-gap: 3px;
            --supply-figure: 17px;
        }
    }
</style>
