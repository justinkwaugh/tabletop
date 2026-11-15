<script lang="ts">
    import type { PoliticsCardSource } from '$lib/model/politicsCardPiles.js'
    import { deckShadow } from '$lib/model/deckShade.js'

    // A shadow in the deck's colour behind a card or deck: place it first inside the card's
    // positioned slot so the card paints over it and only the shadow shows around it.
    let { deck }: { deck: PoliticsCardSource } = $props()
</script>

<div
    class="pointer-events-none absolute inset-0 rounded-md"
    style:box-shadow={deckShadow(deck)}
    aria-hidden="true"
></div>
