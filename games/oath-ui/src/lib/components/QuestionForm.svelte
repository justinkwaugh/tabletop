<script lang="ts">
    import type { Snippet } from 'svelte'
    import { CardKind } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import { CARD_ASPECT, cardAspect } from '$lib/images/cardShape.js'
    import { cardName } from '$lib/model/names.js'

    // R-X.1 — a question is its card, one short line and its answers; the History holds the rest.
    let {
        cardId,
        line,
        children
    }: {
        /** The card the question is about, small beside the line; a tap enlarges it. */
        cardId?: string
        line: Snippet
        children: Snippet
    } = $props()

    // The small card keeps its own shape: an upright card 40 px wide, and a wide one (a Vision's
    // face, printed landscape) as wide as that card is tall, so it shows whole.
    const UPRIGHT_WIDTH = 40
    let width = $derived(
        cardId && cardAspect({ cardId }) > 1
            ? Math.round(UPRIGHT_WIDTH / CARD_ASPECT[CardKind.Denizen])
            : UPRIGHT_WIDTH
    )
</script>

<div class="question-form flex items-start gap-3">
    {#if cardId}
        <span class="shrink-0">
            <CardImage {cardId} {width} label={cardName(cardId)} inspect />
        </span>
    {/if}
    <div class="min-w-0 grow">
        <p class="question-line mb-2 text-base">{@render line()}</p>
        {@render children()}
    </div>
</div>
