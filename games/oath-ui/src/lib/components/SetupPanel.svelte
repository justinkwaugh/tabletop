<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { ActionType } from '@tabletop/oath'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import { range } from '@tabletop/common'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import CardImage from '$lib/components/CardImage.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { discardPositionLabel } from '$lib/model/discardOrder.js'
    import { cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let busy = $derived(gameSession.busy)

    // R-1.23.1 — the start site is picked on the lit map (`BoardSitesLayer`), not in the panel.
    let choosing = $derived(gameSession.validActionTypes.includes(ActionType.SetupChoice))
    let siteId = $derived(gameSession.setup.siteId)
    let adviserCardId = $derived(gameSession.setup.adviserCardId)
    let hand = $derived(gameSession.setup.hand)
    let others = $derived(gameSession.setup.others)
    let tapped = $derived(gameSession.setup.tapped)
    let ordering = $derived(gameSession.setup.ordering)
    let splitWhole = $derived(gameSession.setup.splitWhole)
</script>

<div>
    {#if choosing && gameSession.setup.siteFavor && !ordering}
        {@const split = gameSession.setup.siteFavor}
        {@const pending = gameSession.setup.pendingSiteFavor}
        <!-- R-1.16 — "if there is not enough favor, the Chancellor chooses how to place it". -->
        <div class="mb-2 border-t border-oath-divider pt-1.5 text-sm">
            <p class="mb-1"><TokenText text="Place {gameState.favorSupply} favor:" /></p>
            <div class="mb-1 grid grid-cols-[max-content_auto] items-center gap-x-2.5 gap-y-1">
                {#each split as { siteCardId, favor }, index (siteCardId)}
                    <span>{cardName(siteCardId)}</span>
                    <CountPicker
                        values={range(0, pending[index].wanted + 1)}
                        picked={favor}
                        label={(n) => `place ${n} favor on ${cardName(siteCardId)}`}
                        onpick={(n) => gameSession.setup.setSiteFavor(siteCardId, n)}
                        disabled={busy}
                    />
                {/each}
            </div>
            {#if !splitWhole}
                <p class="text-xs text-oath-danger">
                    {gameSession.setup.siteFavorPlaced} of {gameState.favorSupply} placed.
                </p>
            {/if}
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
        {#if siteId && adviserCardId && !splitWhole}
            <p class="text-sm">
                <TokenText text="Place all {gameState.favorSupply} favor." />
            </p>
        {:else if siteId && adviserCardId}
            <p class="text-sm">Tap to discard; the last goes on top.</p>
        {:else if siteId}
            <p class="text-sm">Keep one.</p>
        {:else if adviserCardId}
            <p class="text-sm">Pick a start site.</p>
        {:else}
            <p class="text-sm">Pick a start site and a card to keep.</p>
        {/if}
    {:else}
        <WaitingOn />
    {/if}
</div>
