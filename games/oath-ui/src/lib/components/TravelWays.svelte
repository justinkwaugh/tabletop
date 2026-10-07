<script lang="ts">
    import { CardKind } from '@tabletop/oath'
    import { CARD_ASPECT } from '$lib/images/cardShape.js'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { favorTokenImage, secretTokenImage } from '$lib/images/tileImages.js'
    import { regionName } from '$lib/model/names.js'
    import type { TravelChoice, TravelRow } from '$lib/model/travelRows.js'
    import { destinationName, travelSpoken, travelTollNotes } from '$lib/model/travelWords.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-11.12, R-7.1.4 — a destination picked on a phone's map with more than one way to pay:
    // the site, and a button per way, each as wide as the widest label. Undo closes it.
    let { row }: { row: TravelRow } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    const nameOf = (playerId: string) => gameSession.getPlayerName(playerId)
</script>

<!-- Rule G: the whole cost is gold. Supply keeps its word; a way that pays in tokens reads its
     number and their symbols ("0 + [secret]"). -->
{#snippet cost(way: TravelChoice)}
    {@const tokens = way.tolls.length > 0 || way.flipSecret}
    <span class="inline-flex items-center gap-1 whitespace-nowrap">
        {tokens && way.cost === 0 ? '0' : `${way.cost} Supply`}
        {#if way.tolls.length > 0}
            <span>+</span>
            {#if way.tolls.length > 1}{way.tolls.length}{/if}
            <img class="ways__token" src={favorTokenImage()} alt="favor" />
        {/if}
        {#if way.flipSecret}
            <span>+</span>
            <img class="ways__token" src={secretTokenImage()} alt="secret" />
        {/if}
    </span>
{/snippet}

<div class="ways">
    <img
        class="ways__art rounded object-cover"
        style:aspect-ratio={CARD_ASPECT[CardKind.Site]}
        src={(row.cardId ? cardImage(row.cardId) : undefined) ?? cardBack(CardKind.Site)}
        alt=""
    />
    <span class="ways__name flex min-w-0 flex-col">
        <span class="text-[15px] font-bold leading-tight">{destinationName(row)}</span>
        <span class="text-[13px] leading-tight text-oath-text-muted">{regionName(row.region)}</span>
    </span>
    <span class="ways__choices flex flex-col items-start gap-1">
        <span class="ways__buttons">
            {#each row.ways as way, index (index)}
                <button
                    type="button"
                    class="rounded-md border border-oath-frame bg-oath-surface px-2.5 py-1.5 text-[15px]
                           font-bold text-oath-accent hover:border-oath-accent hover:bg-oath-accent-soft
                           disabled:opacity-40"
                    disabled={busy}
                    title={travelSpoken(row, way, nameOf)}
                    aria-label={travelSpoken(row, way, nameOf)}
                    onclick={() => gameSession.travelTo(row.slotId, way)}
                >
                    {@render cost(way)}
                </button>
            {/each}
        </span>
        {#each travelTollNotes(row.ways, nameOf) as note (note)}
            <span class="text-[11px] leading-tight text-oath-text-muted">{note}</span>
        {/each}
    </span>
</div>

<style>
    /* One row: the site, its name, the ways beside them. */
    .ways {
        display: grid;
        grid-template-areas: 'art name choices';
        grid-template-columns: auto auto auto;
        justify-content: start;
        align-items: center;
        column-gap: 10px;
        row-gap: 6px;
    }
    /* The row is as tall as the prompt it replaces, so the map does not move when it opens. */
    .ways__art {
        grid-area: art;
        height: 36px;
    }
    .ways__name {
        grid-area: name;
    }
    .ways__choices {
        grid-area: choices;
    }
    /* The buttons stand side by side, each as wide as the widest label. */
    .ways__buttons {
        display: inline-grid;
        grid-auto-columns: 1fr;
        grid-auto-flow: column;
        gap: 6px;
    }
    .ways__token {
        flex: none;
        height: 18px;
        width: auto;
        max-width: none;
    }
    /* A panel too narrow for the site, its name and the ways side by side (a phone held
       upright, where they need about 360 px of 303): the ways go under the name, still as wide
       as their labels. The container is FitBox's unscaled box. */
    @container (max-width: 26rem) {
        .ways {
            grid-template-areas:
                'art name'
                'art choices';
            grid-template-columns: auto 1fr;
        }
    }
</style>
