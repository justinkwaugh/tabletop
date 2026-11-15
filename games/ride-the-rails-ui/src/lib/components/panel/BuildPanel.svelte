<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        buildProgress,
        buildableRailroads,
        endBuildingLabel,
        mountainNote,
        placedCount,
        placedText
    } from '$lib/model/actionArea.js'
    import { shownRailroadCards } from '$lib/model/railroadCards.js'
    import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
    import {
        BUILD_PILE_ROOM,
        BUILD_PILE_ROW,
        fittedPileUnit,
        pileFootprint
    } from '$lib/utils/supplyPile.js'
    import MarkPill from '../board/MarkPill.svelte'
    import SupplyPile from '../board/SupplyPile.svelte'
    import RailroadSpotlightControl from '../RailroadSpotlightControl.svelte'

    const gameSession = getGameSession()

    // R-3.2.1, R-3.2.3, R-3.2.4
    const progress = $derived(buildProgress(gameSession.gameState))
    const note = $derived(progress && mountainNote(progress))

    // R-3.2, R-4.1, R-4.2: on a phone, the piles of the railroads the building seat may place now,
    // the same set that lights the hexes; a railroad that empties or has no legal hex drops out.
    const piles = $derived.by(() => {
        const playerId = gameSession.myPlayerId
        if (!progress || !playerId || !isPhoneWidth()) return []
        const buildable = buildableRailroads(gameSession.gameState, playerId)
        return shownRailroadCards(gameSession).filter((card) => buildable.includes(card.railroadId))
    })

    // The piles' room between the count and the button, measured, and at most 160 px.
    let room = $state(0)
    const unit = $derived(
        fittedPileUnit(
            piles.map((card) => pileFootprint('follow', card.supply).width),
            room > 0 ? Math.min(room, BUILD_PILE_ROOM) : 0,
            BUILD_PILE_ROW
        )
    )
</script>

{#if progress && isPhoneWidth()}
    <!-- Contract, Build: one line on a phone, the placed count, the piles, and the button. -->
    <div class="flex items-center gap-2.5">
        <span class="count rtr-display" aria-hidden="true">{placedCount(progress)}</span>
        <span class="sr-only">{placedText(progress)}{note ? `, ${note}` : ''}</span>
        <div class="piles" role="group" aria-label="Railroads" bind:clientWidth={room}>
            {#each piles as card (card.railroadId)}
                <RailroadSpotlightControl
                    railroadId={card.railroadId}
                    label={card.label}
                    class="build-pile"
                >
                    <SupplyPile
                        railroadId={card.railroadId}
                        supply={card.supply}
                        fit="follow"
                        {unit}
                    />
                </RailroadSpotlightControl>
            {/each}
        </div>
        <button
            type="button"
            class="h-8 shrink-0 rounded-full border-2 border-rtr-pill bg-rtr-pill px-3.5 text-sm font-semibold whitespace-nowrap text-rtr-pill-ink hover:enabled:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rtr-accent disabled:opacity-50"
            disabled={!gameSession.building}
            onclick={() => gameSession.endBuilding()}>{endBuildingLabel(progress)}</button
        >
    </div>
{:else if progress}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 class="text-base font-bold">Place locomotives</h2>
        <span class="text-sm text-rtr-ink-muted">{placedText(progress)}</span>
        {#if note}
            <span class="flex items-center gap-1.5 text-sm text-rtr-ink-muted">
                <MarkPill tone="cost" text="−1" />
                {note}
            </span>
        {/if}
    </div>
    <div class="mt-2 flex flex-wrap gap-2">
        <button
            type="button"
            class="rounded-full border-2 border-rtr-pill bg-rtr-pill px-3.5 py-1 text-sm font-semibold text-rtr-pill-ink hover:enabled:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rtr-accent disabled:opacity-50"
            disabled={!gameSession.building}
            onclick={() => gameSession.endBuilding()}>{endBuildingLabel(progress)}</button
        >
    </div>
{/if}

<style>
    .count {
        flex: none;
        font-size: 18px;
        line-height: 1;
    }

    .piles {
        flex: 1 1 0;
        min-width: 0;
        display: flex;
        gap: 4px;
    }

    /* 2 px above and below keeps the line, and the panel, 50 px tall. */
    .piles :global(.build-pile) {
        display: flex;
        padding: 2px 3px;
        border: 1px solid var(--rtr-rule);
        border-radius: 7px;
    }
</style>
