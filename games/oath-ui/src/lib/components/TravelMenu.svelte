<script lang="ts">
    import { CardKind, Region } from '@tabletop/oath'
    import MenuCount from '$lib/components/MenuCount.svelte'
    import { CARD_ASPECT } from '$lib/images/cardShape.js'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'
    import { pointsAt } from '$lib/model/menuPointer.svelte.js'
    import { regionName } from '$lib/model/names.js'
    import type { TravelChoice, TravelRow } from '$lib/model/travelRows.js'
    import { destinationName, travelSpoken, travelTollNotes } from '$lib/model/travelWords.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.6 — a wide panel's Travel menu: a tile per destination, the regions side by side as
    // columns in the board's order, a button per way to pay. A phone picks on the map instead.
    let gameSession = getGameSession()
    let rows = $derived(gameSession.travelRows)
    let busy = $derived(gameSession.busy)

    const REGIONS = [Region.Cradle, Region.Provinces, Region.Hinterland]
    let groups = $derived(
        REGIONS.map((region) => ({
            region,
            rows: rows.filter((row) => row.region === region)
        })).filter((group) => group.rows.length > 0)
    )

    const nameOf = (playerId: string) => gameSession.getPlayerName(playerId)
    const spoken = (row: TravelRow, way: TravelChoice) => travelSpoken(row, way, nameOf)
</script>

{#snippet art(row: TravelRow)}
    <img
        class="tile__art rounded object-cover"
        style:aspect-ratio={CARD_ASPECT[CardKind.Site]}
        src={(row.cardId ? cardImage(row.cardId) : undefined) ?? cardBack(CardKind.Site)}
        alt=""
    />
{/snippet}

<!-- Rule G: the whole cost is gold, its joiners included. -->
{#snippet cost(way: TravelChoice)}
    <span class="inline-flex flex-wrap items-center gap-x-1.5 text-oath-accent">
        {way.cost} Supply
        {#if way.tolls.length > 0}
            <span>+</span>
            <MenuCount count={way.tolls.length} image={favorToken()} />
        {/if}
        {#if way.flipSecret}
            <span>+ flip</span>
            <MenuCount count={1} image={secretToken()} />
        {/if}
    </span>
{/snippet}

{#snippet notes(ways: TravelChoice[])}
    {#each travelTollNotes(ways, nameOf) as note (note)}
        <span class="tile__note text-oath-text-muted">{note}</span>
    {/each}
{/snippet}

<div class="travel">
    {#each groups as group (group.region)}
        <section class="travel__region">
            <h3
                class="travel__heading text-[11px] font-semibold uppercase tracking-widest text-oath-heading"
            >
                {regionName(group.region)}
            </h3>
            <div
                class="travel__tiles"
                role="list"
                aria-label="Destinations in the {regionName(group.region)}"
            >
                {#each group.rows as row (row.slotId)}
                    <div
                        role="listitem"
                        class="flex"
                        {@attach pointsAt({ kind: 'site', slotId: row.slotId })}
                    >
                        {#if row.ways.length === 1}
                            {@const way = row.ways[0]}
                            <button
                                type="button"
                                class="tile rounded-lg border border-oath-frame bg-oath-surface-raised text-left
                                       hover:border-oath-accent hover:bg-oath-accent-soft
                                       active:border-oath-accent active:bg-oath-accent-soft active:ring-1 active:ring-oath-accent
                                       disabled:opacity-40"
                                disabled={busy}
                                title={spoken(row, way)}
                                aria-label={spoken(row, way)}
                                onclick={() => gameSession.travelTo(row.slotId, way)}
                            >
                                {@render art(row)}
                                <span class="tile__text">
                                    <span class="tile__name font-bold">{destinationName(row)}</span>
                                    <span class="tile__cost font-extrabold">
                                        {@render cost(way)}
                                    </span>
                                    {@render notes(row.ways)}
                                </span>
                            </button>
                        {:else}
                            <div
                                class="tile rounded-lg border border-oath-frame bg-oath-surface-raised"
                            >
                                {@render art(row)}
                                <span class="tile__text">
                                    <span class="tile__name font-bold">{destinationName(row)}</span>
                                    <span class="tile__ways">
                                        {#each row.ways as way, index (index)}
                                            <button
                                                type="button"
                                                class="tile__way rounded-md border border-oath-frame bg-oath-surface font-bold
                                                       hover:border-oath-accent hover:bg-oath-accent-soft disabled:opacity-40"
                                                disabled={busy}
                                                title={spoken(row, way)}
                                                aria-label={spoken(row, way)}
                                                onclick={() =>
                                                    gameSession.travelTo(row.slotId, way)}
                                            >
                                                {@render cost(way)}
                                            </button>
                                        {/each}
                                    </span>
                                    {@render notes(row.ways)}
                                </span>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </section>
    {/each}
</div>

<style>
    /* 100cqw is the width of FitBox's unscaled box, so fitting the panel never changes the
       tiles' layout; 26px is the action panel's padding and border, 28px the two gaps. */
    .travel {
        --tile: calc((100cqw - 26px - 28px) / 3);
        display: flex;
        align-items: start;
        column-gap: 14px;
    }
    .travel__region {
        width: var(--tile);
    }
    .travel__heading {
        margin-bottom: 5px;
    }
    .travel__tiles {
        display: grid;
        grid-template-columns: var(--tile);
        gap: 6px;
    }
    .tile {
        display: flex;
        align-items: start;
        gap: 8px;
        width: 100%;
        padding: 5px;
    }
    .tile__art {
        display: block;
        flex: none;
        width: 46%;
    }
    .tile__text {
        display: flex;
        min-width: 0;
        flex: 1;
        flex-direction: column;
        align-items: start;
        gap: 4px;
    }
    .tile__name {
        min-width: 0;
        font-size: max(15px, calc(var(--tile) * 0.05));
        line-height: 1.15;
    }
    .tile__cost,
    .tile__way {
        font-size: max(13px, calc(var(--tile) * 0.044));
    }
    .tile__cost {
        white-space: nowrap;
    }
    /* A button is as wide as its label, the two sharing the wider one's width. */
    .tile__ways {
        display: grid;
        grid-template-columns: fit-content(100%);
        gap: 4px;
    }
    .tile__way {
        padding: 4px 6px;
    }
    .tile__note {
        font-size: max(11px, calc(var(--tile) * 0.037));
        line-height: 1.2;
    }
</style>
