<script lang="ts">
    import type { Snippet } from 'svelte'
    import CardImage from '$lib/components/CardImage.svelte'
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
</script>

<div class="question-form flex items-start gap-3">
    {#if cardId}
        <span class="shrink-0">
            <CardImage {cardId} width={40} label={cardName(cardId)} inspect />
        </span>
    {/if}
    <div class="min-w-0 grow">
        <p class="question-line mb-2 text-base">{@render line()}</p>
        {@render children()}
    </div>
</div>
