<script lang="ts">
    import CardImage from '$lib/components/CardImage.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { cardName } from '$lib/model/names.js'

    // R-9.4 — the cards a player was shown, each enlarged on hover or hold.
    let { cardIds, height = 72 }: { cardIds: readonly string[]; height?: number } = $props()
</script>

<span class="inline-flex flex-wrap gap-1 align-middle">
    {#each cardIds as cardId (cardId)}
        <CardImage
            {cardId}
            width={widthAtHeight(height, { cardId })}
            label={cardName(cardId)}
            inspect
        />
    {/each}
</span>
