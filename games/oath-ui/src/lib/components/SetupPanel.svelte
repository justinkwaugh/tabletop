<script lang="ts">
    import { ActionType, discardRegionFor } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import CardImage from '$lib/components/CardImage.svelte'
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
</script>

<div>
    {#if choosing && gameSession.setup.siteFavor && !adviserCardId}
        {@const split = gameSession.setup.siteFavor}
        {@const pending = gameSession.setup.pendingSiteFavor}
        <!-- R-1.16 — "if there is not enough favor, the Chancellor chooses how to place it". -->
        <div class="mb-2 border-t border-stone-700/60 pt-1.5 text-xs">
            <div class="mb-1">
                The bank holds {gameState.favorSupply} favor, not enough for every site. Place all of
                it:
                {gameSession.setup.siteFavorPlaced} of {gameState.favorSupply} placed.
            </div>
            {#each split as { siteCardId, favor }, index (siteCardId)}
                <div class="mb-1 flex items-center gap-2">
                    <span class="grow">{cardName(siteCardId)} (prints {pending[index].wanted})</span
                    >
                    <button
                        type="button"
                        class="rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-40 px-2 py-0.5"
                        disabled={busy || favor <= 0}
                        onclick={() => gameSession.setup.setSiteFavor(siteCardId, favor - 1)}
                    >
                        −
                    </button>
                    <span class="w-6 text-center font-semibold">{favor}</span>
                    <button
                        type="button"
                        class="rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-40 px-2 py-0.5"
                        disabled={busy || favor >= pending[index].wanted}
                        onclick={() => gameSession.setup.setSiteFavor(siteCardId, favor + 1)}
                    >
                        +
                    </button>
                </div>
            {/each}
        </div>
    {/if}
    {#if choosing}
        <!-- R-1.20 deals the hand before R-1.23 places the pawn, so it shows from the start. -->
        {#if ordering}
            <div class="flex flex-wrap gap-2 mb-2">
                {#each others as cardId (cardId)}
                    <button
                        class="flex flex-col items-center gap-0.5 rounded border p-1 {tapped.includes(
                            cardId
                        )
                            ? 'border-amber-300 bg-amber-950/60'
                            : 'border-stone-700 hover:border-amber-400'}"
                        disabled={busy}
                        onclick={() => gameSession.setup.tapDiscard(cardId)}
                    >
                        <CardImage
                            {cardId}
                            width={widthAtHeight(100, { cardId })}
                            label={cardName(cardId)}
                            inspect
                        />
                        <span class="text-[10px] text-sky-200 h-3"
                            >{discardPositionLabel(cardId, tapped, others)}</span
                        >
                    </button>
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
                    <span class="text-stone-400">Any faceup site — they are lit on the map.</span>
                </p>
            {:else}
                <p class="text-sm">
                    <span class="font-semibold">Tap the site where your pawn starts</span>
                    <span class="text-stone-400">(lit on the map)</span>
                    <span class="font-semibold">and the card to keep</span> as a facedown adviser.
                </p>
            {/if}
            {#if canGoBack}
                <button
                    class="shrink-0 rounded bg-stone-700 hover:bg-stone-600 px-2 py-1 text-xs font-semibold"
                    disabled={busy}
                    onclick={() => gameSession.back()}
                >
                    Back
                </button>
            {/if}
        </div>
    {:else}
        <p class="text-sm text-stone-400">Waiting for another player to set up.</p>
    {/if}
</div>
