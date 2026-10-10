<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { CardKind } from '@tabletop/oath'
    import { CARD_ASPECT } from '$lib/images/cardShape.js'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { favorTokenImage, secretTokenImage } from '$lib/images/tileImages.js'
    import type { TravelChoice, TravelRow } from '$lib/model/travelRows.js'
    import { destinationName, tollFavor, travelSpoken } from '$lib/model/travelWords.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-11.12, R-7.1.4 — a destination picked on a phone's map with more than one way to pay:
    // the site, and a button per way, each as wide as the widest label; Undo closes it. Held
    // sideways the site, its name and the ways stand on one row; held upright the name
    // alone tops the site's picture, drawn as large as fits, with the ways stacked to its right.
    let { row, upright }: { row: TravelRow; upright: boolean } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    const nameOf = (playerId: string) => gameSession.getPlayerName(playerId)
</script>

<!-- Rule G: the whole cost is gold. Supply keeps its word; a way that pays in tokens reads its
     number and their symbols ("0 + [secret]"), and a toll its favor and its payee's chip
     ("2 Supply + 1 [favor] to <chip>"); the card that asks for it is named in the History. -->
{#snippet cost(way: TravelChoice)}
    {@const tokens = way.tolls.length > 0 || way.flipSecret}
    {@const toll = tollFavor(way)}
    <span class="inline-flex items-center gap-1 whitespace-nowrap">
        {tokens && way.cost === 0 ? '0' : `${way.cost} Supply`}
        {#if toll.given > 0}
            <span>+ {toll.given}</span>
            <img class="ways__token" src={favorTokenImage()} alt="favor" />
            <span>to</span>
            {#each toll.payeeIds as payeeId (payeeId)}
                <PlayerName playerId={payeeId} />
            {/each}
        {/if}
        {#if toll.burned > 0}
            <span>+ {toll.burned}</span>
            <img class="ways__token" src={favorTokenImage()} alt="favor" />
            <span>burned</span>
        {/if}
        {#if way.flipSecret}
            <span>+</span>
            <img class="ways__token" src={secretTokenImage()} alt="secret" />
        {/if}
    </span>
{/snippet}

<div class="ways" class:ways--upright={upright}>
    <img
        class="ways__art rounded object-cover"
        style:aspect-ratio={CARD_ASPECT[CardKind.Site]}
        src={(row.cardId ? cardImage(row.cardId) : undefined) ?? cardBack(CardKind.Site)}
        alt=""
    />
    <span class="ways__name flex min-w-0 flex-col">
        <span class="text-[15px] font-bold leading-tight">{destinationName(row)}</span>
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
    </span>
</div>

<style>
    /* Held sideways, one row: the site, its name, the ways beside them. */
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
    /* Held sideways on a phone whose panel is too narrow for the one row (667 px wide gives
       323 px, the row needs about 360): the ways go under the name, still as wide as their
       labels. The container is FitBox's unscaled box. */
    @container (max-width: 26rem) {
        .ways:not(.ways--upright) {
            grid-template-areas:
                'art name'
                'art choices';
            grid-template-columns: auto 1fr;
        }
    }
    /* Held upright: the name on the top line; under it the picture fills the width the ways
       leave, and the ways stand stacked to its right, level with its top, each as wide as the
       widest label, their right edge at the panel's. */
    .ways--upright {
        grid-template-areas:
            'name name'
            'art choices';
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
    }
    .ways--upright .ways__name {
        align-self: center;
    }
    .ways--upright .ways__art {
        width: 100%;
        height: auto;
    }
    .ways--upright .ways__choices {
        align-items: flex-end;
        width: min-content;
        justify-self: end;
    }
    .ways--upright .ways__buttons {
        grid-auto-columns: auto;
        grid-auto-flow: row;
    }
    .ways__token {
        flex: none;
        height: 18px;
        width: auto;
        max-width: none;
    }
</style>
