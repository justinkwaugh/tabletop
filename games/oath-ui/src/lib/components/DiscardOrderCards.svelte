<script lang="ts">
    import CardImage from '$lib/components/CardImage.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { discardPositionLabel } from '$lib/model/discardOrder.js'
    import { cardName } from '$lib/model/names.js'

    // R-10.5 — each tap puts the card next onto the pile; its place is printed under it.
    let {
        cards,
        tapped,
        busy,
        ontap
    }: {
        cards: string[]
        tapped: string[]
        busy: boolean
        ontap: (cardId: string) => void
    } = $props()
</script>

{#each cards as cardId (cardId)}
    <button
        type="button"
        class="flex flex-col items-center gap-0.5 rounded-[5px] {tapped.includes(cardId)
            ? 'ring-2 ring-sky-300'
            : 'ring-1 ring-stone-600 hover:ring-sky-400'}"
        disabled={busy || tapped.includes(cardId)}
        onclick={() => ontap(cardId)}
    >
        <CardImage
            {cardId}
            width={widthAtHeight(100, { cardId })}
            label={cardName(cardId)}
            inspect
        />
        <span class="text-[10px] text-sky-200 h-3"
            >{discardPositionLabel(cardId, tapped, cards)}</span
        >
    </button>
{/each}
