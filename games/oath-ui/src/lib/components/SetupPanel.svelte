<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { ActionType, CardKind, Region, discardRegionFor } from '@tabletop/oath'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import { range } from '@tabletop/common'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import CardImage from '$lib/components/CardImage.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { discardPositionLabel } from '$lib/model/discardOrder.js'
    import { cardName, regionName, siteName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let busy = $derived(gameSession.busy)

    let choosing = $derived(gameSession.validActionTypes.includes(ActionType.SetupChoice))
    let legalSites = $derived(gameSession.setup.sites)
    let siteId = $derived(gameSession.setup.siteId)
    let adviserCardId = $derived(gameSession.setup.adviserCardId)
    let hand = $derived(gameSession.setup.hand)
    let others = $derived(gameSession.setup.others)
    let tapped = $derived(gameSession.setup.tapped)
    let ordering = $derived(gameSession.setup.ordering)
    let canGoBack = $derived(gameSession.selection.hasManualSelection())

    // R-1.23.1 — the start sites by region in the board's order; one legal site is taken for the player.
    const REGIONS = [Region.Cradle, Region.Provinces, Region.Hinterland]
    let siteGroups = $derived(
        legalSites.length < 2
            ? []
            : REGIONS.map((region) => ({
                  region,
                  sites: legalSites.filter((site) => gameState.regionOf(site) === region)
              })).filter((group) => group.sites.length > 0)
    )

    function siteImage(slotId: string): string {
        const cardId = gameState.siteCardAt(slotId)
        return (cardId ? cardImage(cardId) : undefined) ?? cardBack(CardKind.Site)
    }
</script>

<div>
    {#if choosing && gameSession.setup.siteFavor && !adviserCardId}
        {@const split = gameSession.setup.siteFavor}
        {@const pending = gameSession.setup.pendingSiteFavor}
        <!-- R-1.16 — "if there is not enough favor, the Chancellor chooses how to place it". -->
        <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
            <div class="mb-1">
                <TokenText
                    text="The bank holds {gameState.favorSupply} favor, not enough for every site. Place all of it:"
                />
                {gameSession.setup.siteFavorPlaced} of {gameState.favorSupply} placed.
            </div>
            {#each split as { siteCardId, favor }, index (siteCardId)}
                <div class="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span class="w-56 max-sm:w-full"
                        >{cardName(siteCardId)} (prints {pending[index].wanted})</span
                    >
                    <CountPicker
                        values={range(0, pending[index].wanted + 1)}
                        picked={favor}
                        label={(n) => `place ${n} favor on ${cardName(siteCardId)}`}
                        onpick={(n) => gameSession.setup.setSiteFavor(siteCardId, n)}
                        disabled={busy}
                    />
                </div>
            {/each}
        </div>
    {/if}
    {#if choosing}
        <!-- R-1.20 deals the hand before R-1.23 places the pawn, so it shows from the start. -->
        {#if ordering}
            <div class="flex flex-wrap gap-2 mb-2">
                {#each others as cardId (cardId)}
                    <div class="relative">
                        <button
                            class="flex flex-col items-center gap-0.5 rounded border p-1 {tapped.includes(
                                cardId
                            )
                                ? 'border-oath-accent bg-oath-accent-soft'
                                : 'border-oath-divider hover:border-oath-accent'}"
                            disabled={busy}
                            onclick={() => gameSession.setup.tapDiscard(cardId)}
                        >
                            <CardImage
                                {cardId}
                                width={widthAtHeight(100, { cardId })}
                                label={cardName(cardId)}
                            />
                            <span class="text-[10px] text-oath-heading h-3"
                                >{discardPositionLabel(cardId, tapped, others)}</span
                            >
                        </button>
                        <Magnifier
                            preview={{ cardId, label: cardName(cardId) }}
                            label={cardName(cardId)}
                        />
                    </div>
                {/each}
            </div>
        {:else}
            <div class="mb-2">
                <CardChoiceRow
                    choices={hand.map((cardId) => ({
                        key: cardId,
                        cardId,
                        label: cardName(cardId)
                    }))}
                    picked={adviserCardId ? [adviserCardId] : []}
                    onpick={(cardId) => gameSession.setup.chooseAdviser(cardId)}
                    {busy}
                    height={100}
                />
            </div>
        {/if}
        {#if !ordering && siteGroups.length > 0}
            <div class="mb-2 flex flex-col gap-1.5" role="list" aria-label="Start sites">
                {#each siteGroups as group (group.region)}
                    <h4
                        class="mt-1 text-[11px] font-semibold uppercase tracking-widest text-oath-heading"
                    >
                        {regionName(group.region)}
                    </h4>
                    {#each group.sites as slotId (slotId)}
                        <MenuToggleRow
                            image={siteImage(slotId)}
                            name={siteName(gameState, slotId)}
                            tag="start here"
                            on={siteId === slotId}
                            points={{ kind: 'site', slotId }}
                            disabled={busy}
                            onclick={() => gameSession.setup.chooseSite(slotId)}
                        />
                    {/each}
                {/each}
            </div>
        {/if}
        <div class="flex items-start justify-between gap-2">
            {#if siteId && adviserCardId}
                <p class="text-sm">
                    Keeping <span class="font-semibold">{cardName(adviserCardId)}</span>. The other
                    two go to the
                    <span class="font-semibold"
                        >{regionName(discardRegionFor(gameState.regionOf(siteId)))} discard pile</span
                    >.
                    <span class="font-semibold">Tap the card that is discarded first</span>; the
                    other goes on top.
                </p>
            {:else if siteId}
                <p class="text-sm">
                    Your pawn starts at
                    <span class="font-semibold">{siteName(gameState, siteId)}</span
                    >{legalSites.length === 1 ? ', the top Cradle site' : ''}.
                    <span class="font-semibold">Tap the card to keep</span> as a facedown adviser.
                </p>
            {:else if adviserCardId}
                <p class="text-sm">
                    Keeping <span class="font-semibold">{cardName(adviserCardId)}</span>.
                    <span class="font-semibold">Tap the site where your pawn starts.</span>
                </p>
            {:else}
                <p class="text-sm">
                    <span class="font-semibold">Tap the site where your pawn starts</span>
                    <span class="font-semibold">and the card to keep</span> as a facedown adviser.
                </p>
            {/if}
            {#if canGoBack}
                <button
                    class="shrink-0 rounded bg-oath-control hover:bg-oath-control-hover px-2 py-1 text-xs font-semibold"
                    disabled={busy}
                    onclick={() => gameSession.back()}
                >
                    Back
                </button>
            {/if}
        </div>
    {:else}
        <p class="text-sm text-oath-text-muted">Waiting for another player to set up.</p>
    {/if}
</div>
