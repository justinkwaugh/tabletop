<script lang="ts">
    import { CardKind } from '@tabletop/oath'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { siteName } from '$lib/model/names.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { playToOnMap, playToSiteRows, type PlayToPick } from '$lib/model/playToSites.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.1.4.I the People's Favor, New Growth — "To which site": the seat's own site first, picked
    // until another is tapped, then each other site the play may go to, the picked one ringed. On
    // a desktop, rows for up to four sites, two a row at one width, the widest's. Past four, and
    // on a phone at any number, the sites are lit on the map (`BoardSitesLayer`, "play here") and
    // a line names the site picked.
    let { playTo }: { playTo: PlayToPick } = $props()

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let busy = $derived(gameSession.busy)
    const layout = new PhoneLayout()
    let rows = $derived(playToSiteRows(gameState, playTo))
    let onMap = $derived(playToOnMap(rows.length, layout.phone))
    const width = new ChoiceWidth()

    function siteImage(siteId: string): string {
        const cardId = gameState.isSiteFaceup(siteId) ? gameState.siteCardAt(siteId) : undefined
        return (cardId ? cardImage(cardId) : undefined) ?? cardBack(CardKind.Site)
    }
</script>

<div data-play-to-sites>
    {#if onMap}
        <p class="flex flex-wrap items-baseline gap-x-1 text-xs" data-play-to-line>
            <span class="text-oath-text-muted">To which site:</span>
            {#if playTo.picked}
                <span class="font-semibold">{siteName(gameState, playTo.picked)}</span>
            {:else}
                <span>tap a lit site.</span>
            {/if}
        </p>
    {:else}
        <h4 class="mb-1 text-[11px] font-semibold uppercase tracking-widest text-oath-heading">
            To which site
        </h4>
        <div class="grid grid-cols-[repeat(2,max-content)] gap-1.5 max-sm:grid-cols-1">
            {#each rows as row (row.siteId)}
                <MenuToggleRow
                    image={siteImage(row.siteId)}
                    name={row.name}
                    detail={row.detail}
                    shape="site"
                    on={row.here ? playTo.picked === undefined : playTo.picked === row.siteId}
                    disabled={busy}
                    {width}
                    onclick={() => gameSession.pickPlayToSite(row.siteId)}
                />
            {/each}
        </div>
    {/if}
</div>
